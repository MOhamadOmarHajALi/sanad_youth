import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString() @IsNotEmpty({ message: 'عنوان الإعلان مطلوب' }) @MaxLength(200)
  title: string;

  @IsString() @IsNotEmpty({ message: 'محتوى الإعلان مطلوب' }) @MaxLength(5000)
  content: string;
}
