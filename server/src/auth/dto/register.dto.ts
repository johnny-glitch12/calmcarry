import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  // cap length - bcrypt on an unbounded string is a CPU-DoS vector
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}
