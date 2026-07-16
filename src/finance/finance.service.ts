import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, Like } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Transaction, TransactionType, TransactionCategory } from './entities/transaction.entity';
import { FeeCollection, FeeStatus } from './entities/fee-collection.entity';
import { SalarySlip, SalaryStatus, PaymentMethod } from './entities/salary-slip.entity';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { FounderTransaction, FounderTransactionType } from './entities/founder-transaction.entity';
import { Student } from '../academic/entities/student.entity';
import { User } from '../users/entities/user.entity';
import { Parent } from '../academic/entities/parent.entity';

// Import the two notification services with aliases
import { NotificationService as DbNotificationService } from '../common/services/notification.service';
import { NotificationService as ExternalNotificationService } from '../notification/notification.service';

import { CreateFeeCollectionDto, RecordFeePaymentDto } from './dto/fee-collection.dto';
import { CreateSalarySlipDto, UpdateSalaryStatusDto } from './dto/salary-slip.dto';
import { CreateExpenseDto, UpdateExpenseStatusDto } from './dto/expense.dto';
import { CreateFounderTransactionDto } from './dto/founder-transaction.dto';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(FeeCollection)
    private readonly feeCollectionRepository: Repository<FeeCollection>,

    @InjectRepository(SalarySlip)
    private readonly salarySlipRepository: Repository<SalarySlip>,

    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,

    @InjectRepository(FounderTransaction)
    private readonly founderTransactionRepository: Repository<FounderTransaction>,

    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dbNotificationService: DbNotificationService,
    private readonly externalNotificationService: ExternalNotificationService,
  ) {}

  /**
   * Helper to write records to General Ledger (Transaction table)
   */
  private async recordLedgerEntry(
    type: TransactionType,
    category: TransactionCategory,
    amount: number,
    date: string,
    description: string,
    referenceId: string | null = null,
    recordedByUserId: string | null = null,
  ): Promise<Transaction> {
    const txn = this.transactionRepository.create({
      type,
      category,
      amount,
      date,
      description,
      referenceId,
      recordedByUserId,
    });
    return this.transactionRepository.save(txn);
  }

  // ==========================================
  // FEE COLLECTION WORKFLOWS
  // ==========================================

  async createFeeCollection(dto: CreateFeeCollectionDto): Promise<FeeCollection> {
    // Verify student exists
    const student = await this.studentRepository.findOne({
      where: { id: dto.studentId },
      relations: { user: true },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${dto.studentId} not found`);
    }

    // Generate unique invoice number
    const rand = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${rand}`;

    const feeCollection = this.feeCollectionRepository.create({
      invoiceNumber,
      studentId: dto.studentId,
      academicTerm: dto.academicTerm,
      totalAmount: dto.totalAmount,
      paidAmount: 0,
      dueDate: dto.dueDate,
      status: FeeStatus.PENDING,
      tags: dto.tags || [],
    });

    const saved = await this.feeCollectionRepository.save(feeCollection);

    // Send notifications to Student/Parent
    if (student.user) {
      const email = student.user.email;
      const phone = student.user.phone;
      const amountStr = `$${dto.totalAmount.toFixed(2)}`;
      const title = 'New Fee Invoice Generated';
      const msg = `An invoice ${invoiceNumber} for ${amountStr} has been generated for term ${dto.academicTerm}. Due date: ${dto.dueDate}.`;

      // Save Db notification
      await this.dbNotificationService.sendNotification(student.user.id, title, msg);

      // Send external notification (mocked or live)
      await this.externalNotificationService.sendEmail(email, title, `<p>${msg}</p><p>Please pay before the due date to avoid late fees.</p>`);
      if (phone) {
        await this.externalNotificationService.sendSMS(phone, msg);
        await this.externalNotificationService.sendWhatsApp(phone, msg);
      }
    }

    return saved;
  }

  async recordFeePayment(id: number, dto: RecordFeePaymentDto, recordedByUserId: string): Promise<FeeCollection> {
    const feeCollection = await this.feeCollectionRepository.findOne({
      where: { id },
      relations: { student: { user: true } },
    });
    if (!feeCollection) {
      throw new NotFoundException(`Fee collection invoice with ID ${id} not found`);
    }

    const currentPaid = Number(feeCollection.paidAmount) + dto.amount;
    feeCollection.paidAmount = currentPaid;

    if (currentPaid >= Number(feeCollection.totalAmount)) {
      feeCollection.status = FeeStatus.PAID;
      feeCollection.paidAt = new Date();
    } else {
      feeCollection.status = FeeStatus.PARTIALLY_PAID;
    }

    const saved = await this.feeCollectionRepository.save(feeCollection);

    // Log to General Ledger (Transaction table)
    await this.recordLedgerEntry(
      TransactionType.INCOME,
      TransactionCategory.FEE_COLLECTION,
      dto.amount,
      new Date().toISOString().split('T')[0],
      `Payment received for Invoice ${feeCollection.invoiceNumber}`,
      feeCollection.id.toString(),
      recordedByUserId,
    );

    // Notification of payment receipt
    const studentUser = feeCollection.student?.user;
    if (studentUser) {
      const title = 'Fee Payment Received';
      const msg = `We received payment of $${dto.amount.toFixed(2)} for Invoice ${feeCollection.invoiceNumber}. Current status: ${feeCollection.status}.`;

      await this.dbNotificationService.sendNotification(studentUser.id, title, msg);
      await this.externalNotificationService.sendEmail(studentUser.email, title, `<p>${msg}</p>`);
      if (studentUser.phone) {
        await this.externalNotificationService.sendSMS(studentUser.phone, msg);
      }
    }

    return saved;
  }

  async updateOverdueFees(): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find all collections that are PENDING or PARTIALLY_PAID and have passed due date
    const overdueInvoices = await this.feeCollectionRepository.find({
      where: [
        { status: FeeStatus.PENDING, dueDate: LessThan(todayStr) },
        { status: FeeStatus.PARTIALLY_PAID, dueDate: LessThan(todayStr) },
      ],
      relations: { student: { user: true } },
    });

    for (const inv of overdueInvoices) {
      inv.status = FeeStatus.OVERDUE;
      await this.feeCollectionRepository.save(inv);

      // Notify student/parent
      const studentUser = inv.student?.user;
      if (studentUser) {
        const title = 'ALERT: Fee Payment Overdue';
        const msg = `Your payment for invoice ${inv.invoiceNumber} ($${inv.totalAmount}) was due on ${inv.dueDate} and is now OVERDUE. Please clear this immediately.`;

        await this.dbNotificationService.sendNotification(studentUser.id, title, msg);
        await this.externalNotificationService.sendEmail(studentUser.email, title, `<p style="color: red;"><b>${msg}</b></p>`);
        if (studentUser.phone) {
          await this.externalNotificationService.sendSMS(studentUser.phone, msg);
        }
      }
    }

    return overdueInvoices.length;
  }

  async getFeeCollections(): Promise<FeeCollection[]> {
    return this.feeCollectionRepository.find({ relations: { student: { user: true } } });
  }

  // ==========================================
  // SALARY SLIP WORKFLOWS
  // ==========================================

  async createSalarySlip(dto: CreateSalarySlipDto): Promise<SalarySlip> {
    // Verify user exists and is a teacher/staff member
    const employee = await this.userRepository.findOne({ where: { id: dto.userId }, relations: { role: true } });
    if (!employee) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    const allowances = dto.allowances || 0;
    const deductions = dto.deductions || 0;
    const netSalary = dto.baseSalary + allowances - deductions;

    const salarySlip = this.salarySlipRepository.create({
      userId: dto.userId,
      month: dto.month,
      baseSalary: dto.baseSalary,
      allowances,
      deductions,
      netSalary,
      status: SalaryStatus.SUBMITTED,
      paymentMethod: dto.paymentMethod || PaymentMethod.BANK_TRANSFER,
    });

    const saved = await this.salarySlipRepository.save(salarySlip);

    // Notify admins / co-founders for approval
    const admins = await this.userRepository.find({
      where: { roleId: 1 }, // Assuming Role ID 1 is ADMIN
    });

    const title = 'New Salary Slip Awaiting Approval';
    const msg = `A salary slip for ${employee.firstName} ${employee.lastName} ($${netSalary.toFixed(2)}) for month ${dto.month} has been submitted and is awaiting approval.`;

    for (const admin of admins) {
      await this.dbNotificationService.sendNotification(admin.id, title, msg);
      await this.externalNotificationService.sendEmail(admin.email, title, `<p>${msg}</p>`);
    }

    return saved;
  }

  async updateSalaryStatus(id: number, dto: UpdateSalaryStatusDto, adminUserId: string): Promise<SalarySlip> {
    const salarySlip = await this.salarySlipRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!salarySlip) {
      throw new NotFoundException(`Salary slip with ID ${id} not found`);
    }

    salarySlip.status = dto.status;

    if (dto.status === SalaryStatus.APPROVED) {
      salarySlip.approvedAt = new Date();
    } else if (dto.status === SalaryStatus.PAID) {
      if (salarySlip.status !== SalaryStatus.PAID && !salarySlip.paidAt) {
        salarySlip.paidAt = new Date();

        // Write General Ledger record
        await this.recordLedgerEntry(
          TransactionType.EXPENSE,
          TransactionCategory.SALARY,
          salarySlip.netSalary,
          new Date().toISOString().split('T')[0],
          `Salary payout to ${salarySlip.user.firstName} ${salarySlip.user.lastName} for ${salarySlip.month}`,
          salarySlip.id.toString(),
          adminUserId,
        );

        // Notify employee
        const employee = salarySlip.user;
        const title = 'Salary Payout Credited';
        const msg = `Your salary of $${salarySlip.netSalary.toFixed(2)} for ${salarySlip.month} has been successfully paid via ${salarySlip.paymentMethod}.`;

        await this.dbNotificationService.sendNotification(employee.id, title, msg);
        await this.externalNotificationService.sendEmail(employee.email, title, `<p>${msg}</p>`);
        if (employee.phone) {
          await this.externalNotificationService.sendSMS(employee.phone, msg);
        }
      }
    }

    return this.salarySlipRepository.save(salarySlip);
  }

  async getSalarySlips(): Promise<SalarySlip[]> {
    return this.salarySlipRepository.find({ relations: { user: true } });
  }

  // ==========================================
  // GENERAL OPERATIONAL EXPENSES
  // ==========================================

  async createExpense(dto: CreateExpenseDto, recordedByUserId: string): Promise<Expense> {
    const expense = this.expenseRepository.create({
      category: dto.category,
      amount: dto.amount,
      date: dto.date,
      description: dto.description || '',
      receiptUrl: dto.receiptUrl || null,
      status: ExpenseStatus.PENDING,
      recordedByUserId,
    });

    return this.expenseRepository.save(expense);
  }

  async updateExpenseStatus(id: number, dto: UpdateExpenseStatusDto, adminUserId: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    expense.status = dto.status;

    if (dto.status === ExpenseStatus.PAID) {
      // Log to General Ledger (Transaction table)
      await this.recordLedgerEntry(
        TransactionType.EXPENSE,
        TransactionCategory.GENERAL_EXPENSE,
        expense.amount,
        expense.date,
        `Expense Paid: [${expense.category}] ${expense.description || ''}`,
        expense.id.toString(),
        adminUserId,
      );
    }

    return this.expenseRepository.save(expense);
  }

  async getExpenses(): Promise<Expense[]> {
    return this.expenseRepository.find({ relations: { recordedByUser: true } });
  }

  // ==========================================
  // CO-FOUNDER 50/50 INVESTMENTS & RETURNS
  // ==========================================

  async createFounderTransaction(dto: CreateFounderTransactionDto): Promise<FounderTransaction> {
    // Verify founder user exists
    const founder = await this.userRepository.findOne({ where: { id: dto.founderId } });
    if (!founder) {
      throw new NotFoundException(`Founder with ID ${dto.founderId} not found`);
    }

    const sharePercentage = dto.sharePercentage !== undefined ? dto.sharePercentage : 50.00;

    const ft = this.founderTransactionRepository.create({
      founderId: dto.founderId,
      type: dto.type,
      amount: dto.amount,
      date: dto.date,
      description: dto.description || '',
      sharePercentage,
    });

    const saved = await this.founderTransactionRepository.save(ft);

    // Write General Ledger record
    const ledgerType = dto.type === FounderTransactionType.INVESTMENT ? TransactionType.INCOME : TransactionType.EXPENSE;
    const ledgerCategory = dto.type === FounderTransactionType.INVESTMENT ? TransactionCategory.INVESTMENT : TransactionCategory.FOUNDER_RETURN;

    await this.recordLedgerEntry(
      ledgerType,
      ledgerCategory,
      dto.amount,
      dto.date,
      `Co-Founder ${dto.type}: ${founder.firstName} ${founder.lastName}. Note: ${dto.description || ''}`,
      saved.id.toString(),
      dto.founderId,
    );

    return saved;
  }

  // ==========================================
  // REPORTING: P&L & CO-FOUNDER RATIOS
  // ==========================================

  async getPandLReport(startDate: string, endDate: string) {
    const transactions = await this.transactionRepository.find({
      where: {
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    const breakdown = {
      income: {
        feeCollections: 0,
        investments: 0,
        other: 0,
      },
      expense: {
        salaries: 0,
        generalExpenses: 0,
        founderReturns: 0,
        other: 0,
      },
    };

    for (const t of transactions) {
      const amt = Number(t.amount);
      if (t.type === TransactionType.INCOME) {
        totalIncome += amt;
        if (t.category === TransactionCategory.FEE_COLLECTION) {
          breakdown.income.feeCollections += amt;
        } else if (t.category === TransactionCategory.INVESTMENT) {
          breakdown.income.investments += amt;
        } else {
          breakdown.income.other += amt;
        }
      } else {
        totalExpense += amt;
        if (t.category === TransactionCategory.SALARY) {
          breakdown.expense.salaries += amt;
        } else if (t.category === TransactionCategory.GENERAL_EXPENSE) {
          breakdown.expense.generalExpenses += amt;
        } else if (t.category === TransactionCategory.FOUNDER_RETURN) {
          breakdown.expense.founderReturns += amt;
        } else {
          breakdown.expense.other += amt;
        }
      }
    }

    return {
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      breakdown,
      transactions,
    };
  }

  async getFounderReport() {
    const ftxs = await this.founderTransactionRepository.find({
      relations: { founder: true },
    });

    // Group by founder ID
    const founderSummary: Record<string, {
      name: string;
      totalInvested: number;
      totalWithdrawn: number;
      netBalance: number;
    }> = {};

    for (const ft of ftxs) {
      const fid = ft.founderId;
      const amt = Number(ft.amount);

      if (!founderSummary[fid]) {
        founderSummary[fid] = {
          name: `${ft.founder.firstName} ${ft.founder.lastName}`,
          totalInvested: 0,
          totalWithdrawn: 0,
          netBalance: 0,
        };
      }

      if (ft.type === FounderTransactionType.INVESTMENT) {
        founderSummary[fid].totalInvested += amt;
        founderSummary[fid].netBalance += amt;
      } else {
        founderSummary[fid].totalWithdrawn += amt;
        founderSummary[fid].netBalance -= amt;
      }
    }

    // Calculate co-founder ratios (investments vs returns)
    const summaryList = Object.entries(founderSummary).map(([founderId, val]) => ({
      founderId,
      ...val,
    }));

    let ratioMessage = '50/50 parity check: OK';
    let parityDiscrepancy = 0;

    if (summaryList.length === 2) {
      const f1 = summaryList[0];
      const f2 = summaryList[1];
      
      // Check difference in investments
      const investDiff = Math.abs(f1.totalInvested - f2.totalInvested);
      const returnsDiff = Math.abs(f1.totalWithdrawn - f2.totalWithdrawn);

      if (investDiff > 0.01 || returnsDiff > 0.01) {
        ratioMessage = `Warning: Co-founders are out of sync. Investment diff: $${investDiff.toFixed(2)}, returns diff: $${returnsDiff.toFixed(2)}`;
        parityDiscrepancy = Math.max(investDiff, returnsDiff);
      }
    } else if (summaryList.length === 1) {
      ratioMessage = 'Only one co-founder has logged transactions.';
    } else if (summaryList.length === 0) {
      ratioMessage = 'No founder transactions logged yet.';
    }

    return {
      ratioMessage,
      parityDiscrepancy,
      founders: summaryList,
      rawTransactions: ftxs,
    };
  }

  async seedTestData(): Promise<any> {
    // Deletions first
    await this.transactionRepository.createQueryBuilder().delete().execute();
    await this.founderTransactionRepository.createQueryBuilder().delete().execute();
    await this.feeCollectionRepository.createQueryBuilder().delete().execute();
    await this.salarySlipRepository.createQueryBuilder().delete().execute();
    await this.expenseRepository.createQueryBuilder().delete().execute();
    
    // Clean up test students/users
    const testUsers = await this.userRepository.find({
      where: [
        { email: Like('%@ggit.com') },
        { email: 'aliraza@ggit.com' }
      ]
    });
    
    for (const u of testUsers) {
      await this.studentRepository.delete({ userId: u.id });
      await this.userRepository.delete({ id: u.id });
    }
    
    // Hash default password
    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('GGIT1234', salt);
    
    const createUserDirect = async (email: string, firstName: string, lastName: string, roleId: number) => {
      const user = this.userRepository.create({
        email,
        firstName,
        lastName,
        roleId,
        passwordHash: defaultPasswordHash,
        phone: '+14155238886', // Valid twilio format
        isActive: true,
      });
      return this.userRepository.save(user);
    };

    // Create Co-founders
    const founder1 = await createUserDirect('founder1@ggit.com', 'John', 'FounderA', 1);
    const founder2 = await createUserDirect('founder2@ggit.com', 'Sarah', 'FounderB', 1);

    // Create Teacher Ali Raza
    const teacher = await createUserDirect('aliraza@ggit.com', 'Ali', 'Raza', 2);

    // Create 5 Students
    const studentUsers: User[] = [];
    const students: Student[] = [];
    for (let i = 1; i <= 5; i++) {
      const sUser = await createUserDirect(`student${i}@ggit.com`, `Student`, `${i}`, 3);
      studentUsers.push(sUser);
      
      const sReg = `GGIT-2026-100${i}`;
      const student = this.studentRepository.create({
        userId: sUser.id,
        registrationNo: sReg,
        admissionDate: '2026-07-01',
      });
      const savedStudent = await this.studentRepository.save(student);
      students.push(savedStudent);
    }

    // Create Parent User and Profile
    const parentUser = await createUserDirect('parent@ggit.com', 'Sarah', 'Parent', 4);
    const parent = this.studentRepository.manager.create(Parent, {
      userId: parentUser.id,
      students: [students[0], students[1]]
    });
    await this.studentRepository.manager.save(Parent, parent);

    // Seed Co-founder Investments ($30,000 each)
    const ft1 = this.founderTransactionRepository.create({
      founderId: founder1.id,
      type: FounderTransactionType.INVESTMENT,
      amount: 30000,
      date: '2026-07-01',
      description: 'Initial Capital Injection',
      sharePercentage: 50.00,
    });
    await this.founderTransactionRepository.save(ft1);
    await this.recordLedgerEntry(
      TransactionType.INCOME,
      TransactionCategory.INVESTMENT,
      30000,
      '2026-07-01',
      `Co-Founder Investment: John FounderA`,
      ft1.id.toString(),
      founder1.id
    );

    const ft2 = this.founderTransactionRepository.create({
      founderId: founder2.id,
      type: FounderTransactionType.INVESTMENT,
      amount: 30000,
      date: '2026-07-01',
      description: 'Initial Capital Injection',
      sharePercentage: 50.00,
    });
    await this.founderTransactionRepository.save(ft2);
    await this.recordLedgerEntry(
      TransactionType.INCOME,
      TransactionCategory.INVESTMENT,
      30000,
      '2026-07-01',
      `Co-Founder Investment: Sarah FounderB`,
      ft2.id.toString(),
      founder2.id
    );

    // Seed 5 Student Fees ($35,000 total, i.e., $7,000 each)
    for (let i = 0; i < 5; i++) {
      const student = students[i];
      const invoiceNumber = `INV-2026-000${i+1}`;
      const fee = this.feeCollectionRepository.create({
        invoiceNumber,
        studentId: student.id,
        academicTerm: 'Fall 2026',
        totalAmount: 7000,
        paidAmount: 7000,
        dueDate: '2026-07-10',
        status: FeeStatus.PAID,
        tags: ['Tuition'],
        paidAt: new Date('2026-07-08'),
      });
      const savedFee = await this.feeCollectionRepository.save(fee);
      
      // Ledger entry
      await this.recordLedgerEntry(
        TransactionType.INCOME,
        TransactionCategory.FEE_COLLECTION,
        7000,
        '2026-07-08',
        `Fee Payment: ${studentUsers[i].firstName} ${studentUsers[i].lastName} (Invoice ${invoiceNumber})`,
        savedFee.id.toString(),
        founder1.id
      );
    }

    // Seed Teacher Salary (Ali Raza) - 3 students assigned * $1,200/student = $3,600
    const salary = this.salarySlipRepository.create({
      userId: teacher.id,
      month: '2026-07',
      baseSalary: 3600,
      allowances: 0,
      deductions: 0,
      netSalary: 3600,
      status: SalaryStatus.PAID,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      approvedAt: new Date('2026-07-14'),
      paidAt: new Date('2026-07-15'),
    });
    const savedSalary = await this.salarySlipRepository.save(salary);
    await this.recordLedgerEntry(
      TransactionType.EXPENSE,
      TransactionCategory.SALARY,
      3600,
      '2026-07-15',
      `Salary payout to Ali Raza for 2026-07`,
      savedSalary.id.toString(),
      founder1.id
    );

    // Seed Other Expense ($5,000)
    const expense = this.expenseRepository.create({
      category: 'OTHER',
      amount: 5000,
      date: '2026-07-05',
      description: 'General institution setup and marketing logistics',
      status: ExpenseStatus.PAID,
      recordedByUserId: founder1.id,
    });
    const savedExpense = await this.expenseRepository.save(expense);
    await this.recordLedgerEntry(
      TransactionType.EXPENSE,
      TransactionCategory.GENERAL_EXPENSE,
      5000,
      '2026-07-05',
      `Expense Paid: [OTHER] General institution setup and marketing logistics`,
      savedExpense.id.toString(),
      founder1.id
    );

    // Seed Profit Distribution of net profit ($26,400 split 50/50, i.e., $13,200 each)
    const distributionAmount = 13200;
    
    // John FounderA payout
    const ftReturn1 = this.founderTransactionRepository.create({
      founderId: founder1.id,
      type: FounderTransactionType.RETURN,
      amount: distributionAmount,
      date: '2026-07-15',
      description: 'Profit distribution 50% split (July 2026)',
      sharePercentage: 50.00,
    });
    await this.founderTransactionRepository.save(ftReturn1);
    await this.recordLedgerEntry(
      TransactionType.EXPENSE,
      TransactionCategory.FOUNDER_RETURN,
      distributionAmount,
      '2026-07-15',
      `Co-Founder Payout: John FounderA (50% share)`,
      ftReturn1.id.toString(),
      founder1.id
    );

    // Sarah FounderB payout
    const ftReturn2 = this.founderTransactionRepository.create({
      founderId: founder2.id,
      type: FounderTransactionType.RETURN,
      amount: distributionAmount,
      date: '2026-07-15',
      description: 'Profit distribution 50% split (July 2026)',
      sharePercentage: 50.00,
    });
    await this.founderTransactionRepository.save(ftReturn2);
    await this.recordLedgerEntry(
      TransactionType.EXPENSE,
      TransactionCategory.FOUNDER_RETURN,
      distributionAmount,
      '2026-07-15',
      `Co-Founder Payout: Sarah FounderB (50% share)`,
      ftReturn2.id.toString(),
      founder2.id
    );

    return {
      message: 'Finance simulation data successfully seeded!',
      founders: [founder1.email, founder2.email],
      teacher: teacher.email,
      studentsCount: students.length,
    };
  }

  async getStudentInvoices(userId: string): Promise<FeeCollection[]> {
    const student = await this.studentRepository.findOne({ where: { userId } });
    if (!student) {
      throw new NotFoundException(`Student record for user ID ${userId} not found`);
    }
    return this.feeCollectionRepository.find({
      where: { studentId: student.id },
      order: { dueDate: 'DESC' },
    });
  }

  async getTeacherSalaries(userId: string): Promise<SalarySlip[]> {
    return this.salarySlipRepository.find({
      where: { userId },
      order: { month: 'DESC' },
    });
  }

  async getParentStudentFees(parentUserId: string, studentId: number): Promise<FeeCollection[]> {
    const parent = await this.feeCollectionRepository.manager.findOne(Parent, {
      where: { userId: parentUserId },
      relations: { students: true },
    });
    if (!parent) {
      throw new NotFoundException(`Parent profile not found`);
    }
    const isChild = parent.students.some((s) => Number(s.id) === studentId);
    if (!isChild) {
      throw new BadRequestException('Authorized child matching student ID not found');
    }
    return this.feeCollectionRepository.find({
      where: { studentId },
      order: { dueDate: 'DESC' },
    });
  }

  async payParentStudentFee(parentUserId: string, studentId: number, feeId: number, amount: number): Promise<any> {
    const parent = await this.feeCollectionRepository.manager.findOne(Parent, {
      where: { userId: parentUserId },
      relations: { students: true },
    });
    if (!parent) {
      throw new NotFoundException(`Parent profile not found`);
    }
    const isChild = parent.students.some((s) => Number(s.id) === studentId);
    if (!isChild) {
      throw new BadRequestException('Authorized child matching student ID not found');
    }
    const fee = await this.feeCollectionRepository.findOne({ where: { id: feeId, studentId } });
    if (!fee) {
      throw new NotFoundException('Fee invoice not found for this student');
    }
    return this.recordFeePayment(feeId, { amount }, parentUserId);
  }
}
