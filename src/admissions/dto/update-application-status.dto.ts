import { IsEnum } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';
}
