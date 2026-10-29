import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateApplicationDto {
  @IsNumber()
  @IsNotEmpty()
  programId: number;

  @IsString()
  @IsOptional()
  cvUrl?: string; // رابط السيرة الذاتية المرفوعة
}