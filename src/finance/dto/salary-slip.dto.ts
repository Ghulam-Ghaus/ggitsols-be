import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { SalaryStatus, PaymentMethod } from '../entities/salary-slip.entity';

export class CreateSalarySlipDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  month: string; // e.g. "2026-07"

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  baseSalary: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  allowances?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deductions?: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;
}

export class UpdateSalaryStatusDto {
  @IsEnum(SalaryStatus)
  @IsNotEmpty()
  status: SalaryStatus;
}
