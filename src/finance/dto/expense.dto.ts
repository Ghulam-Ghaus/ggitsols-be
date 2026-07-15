import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, IsDateString, Min } from 'class-validator';
import { ExpenseStatus } from '../entities/expense.entity';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

export class UpdateExpenseStatusDto {
  @IsEnum(ExpenseStatus)
  @IsNotEmpty()
  status: ExpenseStatus;
}
