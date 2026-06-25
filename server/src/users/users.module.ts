import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entitlement, Owner } from '../entities';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([Owner, Entitlement])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
