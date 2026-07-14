import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SocialLoginDto {
  @IsIn(['apple', 'google'])
  provider: 'apple' | 'google';

  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  idToken: string;

  // Apple one-time authorization code - exchanged for a refresh token so the account
  // can be revoked on deletion. Optional; Google sign-in omits it.
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  authorizationCode?: string;
}
