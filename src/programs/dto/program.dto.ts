import { Type } from 'class-transformer';
import {
  IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Max, MaxLength, Min,
} from 'class-validator';

export class ListProgramsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 10;

  @IsOptional() @IsString() @MaxLength(100)
  search?: string;
}

export class CreateProgramDto {
  @IsString() @IsNotEmpty({ message: 'عنوان البرنامج مطلوب' }) @MaxLength(200)
  title: string;

  @IsString() @IsNotEmpty({ message: 'وصف البرنامج مطلوب' }) @MaxLength(5000)
  description: string;

  @Type(() => Number) @IsInt() @Min(1, { message: 'عدد المقاعد يجب أن يكون 1 على الأقل' }) @Max(100000)
  totalSeats: number;

  @IsOptional() @IsUrl()
  image?: string;
}

export class CreateSessionDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsDateString({}, { message: 'التاريخ يجب أن يكون بصيغة ISO مثل 2026-11-20T10:00:00Z' })
  date: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  locationOrLink: string;
}

export class CreateMaterialDto {
  @IsString() @IsNotEmpty({ message: 'عنوان المادة مطلوب' }) @MaxLength(200)
  title: string;
}
