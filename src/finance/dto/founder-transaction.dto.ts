import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { FounderTransactionType } from '../entities/founder-transaction.entity';

export class CreateFounderTransactionDto {
  @IsString()
  @IsNotEmpty()
  founderId: string;

  @IsEnum(FounderTransactionType)
  @IsNotEmpty()
  type: FounderTransactionType;

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

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sharePercentage?: number;
}
