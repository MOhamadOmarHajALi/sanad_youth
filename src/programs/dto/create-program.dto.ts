import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty({ message: 'عنوان البرنامج مطلوب' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'وصف البرنامج مطلوب' })
  description: string;

  @IsNumber()
  @Min(1, { message: 'يجب أن يكون عدد المقاعد أكبر من صفر' })
  totalSeats: number;

  @IsString()
  @IsOptional()
  image?: string;
}