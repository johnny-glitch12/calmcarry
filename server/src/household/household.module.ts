import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaregiverLink } from '../entities';
import { HouseholdService } from './household.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CaregiverLink])],
  providers: [HouseholdService],
  exports: [HouseholdService],
})
export class HouseholdModule {}
