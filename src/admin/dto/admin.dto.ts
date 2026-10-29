import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateInstructorDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  fullName: string;

  @Matches(/^[a-zA-Z0-9_.-]{3,30}$/)
  username: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(8) @MaxLength(72)
  password: string;
}
