import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER } from '@nestjs/core';
import { envValidationSchema } from './config/env.validation';
import { databaseConfig } from './config/database.config';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { SchoolJoinRequestsModule } from './modules/school-join-requests/school-join-requests.module';
import { SchoolActivitiesModule } from './modules/school-activities/school-activities.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { StudentsModule } from './modules/students/students.module';
import { ParentsModule } from './modules/parents/parents.module';
import { ItemsModule } from './modules/items/items.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './common/storage/storage.module';
import { PaystackModule } from './common/paystack/paystack.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'dev'}`, '.env'],
      load: [databaseConfig],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database')!,
    }),
    ScheduleModule.forRoot(),
    StorageModule,
    PaystackModule,
    AuthModule,
    CardsModule,
    SchoolsModule,
    SchoolJoinRequestsModule,
    SchoolActivitiesModule,
    VendorsModule,
    StudentsModule,
    ParentsModule,
    ItemsModule,
    WalletsModule,
    PaymentsModule,
    OrdersModule,
    WithdrawalsModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
