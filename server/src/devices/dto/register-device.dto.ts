import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  // Constrain to the real serial namespace so oversized/garbage values are rejected
  // at the edge before they hit the unique index or normalization.
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9-]{4,40}$/, { message: 'serial must be 4-40 letters, digits or hyphens' })
  serial: string;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  retailer?: string;
}
