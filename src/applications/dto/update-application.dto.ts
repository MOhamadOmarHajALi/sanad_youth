import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApplicationStatus } from '../../common/enums/applicationStatus.enum.js';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus, { message: 'حالة الطلب غير صالحة' })
  @IsNotEmpty()
  status: ApplicationStatus; // PENDING, ACCEPTED, REJECTED, CANCELLED
}