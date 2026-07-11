import { IsString, IsEmail, IsOptional, IsNumber, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class DocumentDto {
  @IsString()
  documentName: string;

  @IsString()
  fileUrl: string;
}

export class CreateApplicationDto {
  @IsNumber()
  @IsOptional()
  courseId?: number;

  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  guardianName?: string;

  @IsString()
  @IsOptional()
  guardianRelation?: string;

  @IsString()
  @IsOptional()
  guardianPhone?: string;

  @IsEmail()
  @IsOptional()
  @IsString()
  guardianEmail?: string;

  @IsString()
  @IsOptional()
  guardian2Name?: string;

  @IsString()
  @IsOptional()
  guardian2Relation?: string;

  @IsString()
  @IsOptional()
  guardian2Phone?: string;

  @IsEmail()
  @IsOptional()
  @IsString()
  guardian2Email?: string;

  @IsBoolean()
  @IsOptional()
  hasSibling?: boolean;

  @IsString()
  @IsOptional()
  siblingName?: string;

  @IsString()
  @IsOptional()
  siblingRegistrationNo?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents?: DocumentDto[];
}
