import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Card } from '../cards/entities/card.entity';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { User } from '../users/entities/user.entity';
import { Parent } from '../parents/entities/parent.entity';
import { RefreshToken } from '../refresh-tokens/entities/refresh-token.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { School } from '../schools/entities/school.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { VendorWallet } from '../vendors/entities/vendor-wallet.entity';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([
      Card,
      Student,
      StudentParent,
      User,
      Parent,
      RefreshToken,
      Wallet,
      School,
      Vendor,
      VendorWallet,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('ACCESS_TOKEN_EXPIRY') ??
            '15m') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
