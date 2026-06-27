import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { CommunityService } from './community.service';

class CreatePostDto {
  @IsString()
  @MinLength(2)
  @MaxLength(400)
  text: string;

  // Optional shared sound-machine mix. Accepted loosely here, then fully whitelisted
  // + clamped in the service (known sound keys only) so no arbitrary JSON is stored.
  @IsOptional()
  @IsObject()
  mix?: Record<string, unknown>;
}

/** Adults-only, anonymous-by-default wins wall. The client gates this to adult profiles. */
@Controller('community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('posts')
  async posts() {
    const [posts, presence] = await Promise.all([
      this.community.listApproved(),
      this.community.presence(),
    ]);
    return { presence, posts };
  }

  @Post('posts')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePostDto) {
    return this.community.create(user.sub, dto.text, dto.mix);
  }
}
