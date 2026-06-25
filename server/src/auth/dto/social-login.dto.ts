import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SocialLoginDto {
  @IsIn(['apple', 'google'])
  provider: 'apple' | 'google';

  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  idToken: string;
}
