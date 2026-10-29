import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMaterialDto {
  @IsString() @IsNotEmpty({ message: 'عنوان المادة مطلوب' }) @MaxLength(200)
  title: string;
}

// multipart: title و/أو file (واحد منهما على الأقل)
export class UpdateMaterialDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  title?: string;
}
