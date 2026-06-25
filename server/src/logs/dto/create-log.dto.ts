import { IsOptional, IsString, MaxLength } from 'class-validator';

// A session log records only THAT a session ran (content + device + time) — never
// a mood/settle rating. The plan forbids symptom tracking & mood history (§3/§13).
export class CreateLogDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  contentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceId?: string;
}
