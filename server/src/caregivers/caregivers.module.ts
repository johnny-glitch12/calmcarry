import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CaregiverInvite, CaregiverLink, Owner } from '../entities';
import { CaregiversController } from './caregivers.controller';
import { CaregiversService } from './caregivers.service';

@Module({
  imports: [TypeOrmModule.forFeature([CaregiverInvite, CaregiverLink, Owner]), AuthModule],
  controllers: [CaregiversController],
  providers: [CaregiversService],
})
export class CaregiversModule {}
