import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  fullName: string;

  @Matches(/^[a-zA-Z0-9_.-]{3,30}$/, { message: 'اسم المستخدم 3-30 حرفاً (أحرف إنجليزية وأرقام و _ . -)' })
  username: string;

  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @IsString() @MinLength(8, { message: 'كلمة المرور 8 أحرف على الأقل' }) @MaxLength(72)
  password: string;
}

export class LoginDto {
  @IsString() @IsNotEmpty({ message: 'البريد أو اسم المستخدم مطلوب' })
  identifier: string;

  @IsString() @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  password: string;
}

export class RefreshDto {
  @IsString() @IsNotEmpty()
  refreshToken: string;
}
