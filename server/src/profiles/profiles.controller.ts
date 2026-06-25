import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { ProfileType } from '../entities';
import { ProfilesService } from './profiles.service';

class CreateProfileDto {
  @IsString()
  @MaxLength(40)
  name: string;

  @IsIn(['adult', 'kids'])
  type: ProfileType;

  // child age band — constrained set, never unbounded free text (COPPA data hygiene)
  @IsOptional()
  @IsIn(['0-3', '4-7', '8-12', '13-17', 'adult'])
  ageBand?: string;
}

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(40) name?: string;
  @IsOptional() @IsIn(['0-3', '4-7', '8-12', '13-17', 'adult']) ageBand?: string;
  @IsOptional() @IsBoolean() anonymous?: boolean;
}

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.profiles.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProfileDto) {
    return this.profiles.create(user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.profiles.remove(user.sub, id);
  }
}
