import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from './entities/withdrawal.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { VendorWallet } from '../vendors/entities/vendor-wallet.entity';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Withdrawal, Vendor, VendorWallet])],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
})
export class WithdrawalsModule {}
