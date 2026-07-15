import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { Transaction } from './entities/transaction.entity';
import { FeeCollection } from './entities/fee-collection.entity';
import { SalarySlip } from './entities/salary-slip.entity';
import { Expense } from './entities/expense.entity';
import { FounderTransaction } from './entities/founder-transaction.entity';
import { Student } from '../academic/entities/student.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      FeeCollection,
      SalarySlip,
      Expense,
      FounderTransaction,
      Student,
      User,
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
