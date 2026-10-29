import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Identifier (email or username) is required' })
  identifier: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}