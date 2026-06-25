import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  // cap length — bcrypt on an unbounded string is a CPU-DoS vector
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
