import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from '../config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Owner, Profile } from '../entities';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Profile, Owner]), JwtModule.register({ secret: config.jwtSecret })],
  controllers: [ProfilesController],
  providers: [ProfilesService, JwtAuthGuard],
})
export class ProfilesModule {}
