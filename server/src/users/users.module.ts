import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entitlement, Owner } from '../entities';
import { UsersService } from './users.service';

/** Global: JwtAuthGuard needs UsersService to check the session generation, and the
 *  guard is provided by seven different feature modules. Mirrors IntegrationsModule. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Owner, Entitlement])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
