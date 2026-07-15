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

  // Display name from the provider's native sheet. Apple sends fullName ONLY on the
  // first authorization and never inside the id token, so without this a Hide-My-Email
  // account is named after its relay address ("xk3j9q2m") forever.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
