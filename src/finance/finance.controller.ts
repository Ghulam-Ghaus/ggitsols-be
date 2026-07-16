import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateFeeCollectionDto, RecordFeePaymentDto } from './dto/fee-collection.dto';
import { CreateSalarySlipDto, UpdateSalaryStatusDto } from './dto/salary-slip.dto';
import { CreateExpenseDto, UpdateExpenseStatusDto } from './dto/expense.dto';
import { CreateFounderTransactionDto } from './dto/founder-transaction.dto';

@Controller('finance')
@UseGuards(AuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ==========================================
  // STUDENT PORTAL / ACCESS ROUTES
  // ==========================================

  @Get('my-fees')
  @Roles('STUDENT', 'PARENT', 'ADMIN')
  async getMyFees(@Request() req: any) {
    return this.financeService.getStudentInvoices(req.user.id);
  }

  @Post('my-fees/:id/pay')
  @Roles('STUDENT', 'PARENT', 'ADMIN')
  async payMyFee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordFeePaymentDto,
    @Request() req: any,
  ) {
    // Record payment directly using student user ID as recorder
    return this.financeService.recordFeePayment(id, dto, req.user.id);
  }

  @Get('my-salaries')
  @Roles('TEACHER', 'ADMIN')
  async getMySalaries(@Request() req: any) {
    return this.financeService.getTeacherSalaries(req.user.id);
  }

  @Get('parents/students/:studentId/fees')
  @Roles('PARENT', 'ADMIN')
  async getParentStudentFees(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Request() req: any,
  ) {
    return this.financeService.getParentStudentFees(req.user.id, studentId);
  }

  @Post('parents/students/:studentId/fees/:feeId/pay')
  @Roles('PARENT', 'ADMIN')
  async payParentStudentFee(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('feeId', ParseIntPipe) feeId: number,
    @Body() dto: RecordFeePaymentDto,
    @Request() req: any,
  ) {
    return this.financeService.payParentStudentFee(req.user.id, studentId, feeId, dto.amount);
  }

  // ==========================================
  // FEE COLLECTIONS (ADMIN-ONLY)
  // ==========================================

  @Post('fees')
  @Roles('ADMIN')
  async createFeeCollection(@Body() dto: CreateFeeCollectionDto) {
    return this.financeService.createFeeCollection(dto);
  }

  @Post('fees/:id/pay')
  @Roles('ADMIN')
  async recordFeePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordFeePaymentDto,
    @Request() req: any,
  ) {
    return this.financeService.recordFeePayment(id, dto, req.user.id);
  }

  @Post('fees/trigger-overdue')
  @Roles('ADMIN')
  async triggerOverdueFees() {
    const updatedCount = await this.financeService.updateOverdueFees();
    return { message: 'Overdue invoices check completed', updatedCount };
  }

  @Get('fees')
  @Roles('ADMIN')
  async getFeeCollections() {
    return this.financeService.getFeeCollections();
  }

  // ==========================================
  // SALARY SLIPS (ADMIN-ONLY)
  // ==========================================

  @Post('salaries')
  @Roles('ADMIN')
  async createSalarySlip(@Body() dto: CreateSalarySlipDto) {
    return this.financeService.createSalarySlip(dto);
  }

  @Patch('salaries/:id/status')
  @Roles('ADMIN')
  async updateSalaryStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSalaryStatusDto,
    @Request() req: any,
  ) {
    return this.financeService.updateSalaryStatus(id, dto, req.user.id);
  }

  @Get('salaries')
  @Roles('ADMIN')
  async getSalarySlips() {
    return this.financeService.getSalarySlips();
  }

  // ==========================================
  // GENERAL OPERATIONAL EXPENSES (ADMIN-ONLY)
  // ==========================================

  @Post('expenses')
  @Roles('ADMIN')
  async createExpense(@Body() dto: CreateExpenseDto, @Request() req: any) {
    return this.financeService.createExpense(dto, req.user.id);
  }

  @Patch('expenses/:id/status')
  @Roles('ADMIN')
  async updateExpenseStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseStatusDto,
    @Request() req: any,
  ) {
    return this.financeService.updateExpenseStatus(id, dto, req.user.id);
  }

  @Get('expenses')
  @Roles('ADMIN')
  async getExpenses() {
    return this.financeService.getExpenses();
  }

  // ==========================================
  // CO-FOUNDER TRANSACTIONS (ADMIN-ONLY)
  // ==========================================

  @Post('founder-transactions')
  @Roles('ADMIN')
  async createFounderTransaction(@Body() dto: CreateFounderTransactionDto) {
    return this.financeService.createFounderTransaction(dto);
  }

  // ==========================================
  // REPORTING (ADMIN-ONLY)
  // ==========================================

  @Get('reports/p-and-l')
  @Roles('ADMIN')
  async getPandLReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financeService.getPandLReport(startDate, endDate);
  }

  @Get('reports/founders')
  @Roles('ADMIN')
  async getFounderReport() {
    return this.financeService.getFounderReport();
  }

  @Post('seed-test-data')
  @Roles('ADMIN')
  async seedTestData() {
    const data = await this.financeService.seedTestData();
    return data;
  }
}
