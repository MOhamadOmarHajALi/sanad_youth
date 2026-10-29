import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { AnnouncementType } from '../../common/enums/announcementType.enum.js';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: 'عنوان الإعلان مطلوب' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'محتوى الإعلان مطلوب' })
  content: string;

  @IsEnum(AnnouncementType, { message: 'نوع الإعلان غير صالح' })
  @IsNotEmpty()
  type: AnnouncementType ; // GENERAL أو PROGRAM_SPECIFIC

  @IsNumber()
  @IsOptional()
  programId?: number; // يُطلب في حال كان الإعلن خاص ببرنامج معين
}