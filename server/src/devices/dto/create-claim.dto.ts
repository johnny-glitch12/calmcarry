import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
