import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from '../config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContentItem, Program } from '../entities';
import { UsersModule } from '../users/users.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentItem, Program]),
    UsersModule,
    JwtModule.register({ secret: config.jwtSecret }),
  ],
  controllers: [ContentController],
  providers: [ContentService, JwtAuthGuard],
  exports: [ContentService],
})
export class ContentModule {}
