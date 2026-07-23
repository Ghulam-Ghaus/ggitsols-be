import { IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional, IsArray, Min } from 'class-validator';

export class CreateFeeCollectionDto {
  @IsNumber()
  @IsNotEmpty()
  studentId: number;

  @IsString()
  @IsNotEmpty()
  academicTerm: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  totalAmount: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  originalAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsDateString()
  @IsNotEmpty()
  dueDate: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class RecordFeePaymentDto {
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;
}
