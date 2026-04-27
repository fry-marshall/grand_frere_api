import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYSTACK_SERVICE } from './paystack.interface';
import { PaystackService } from './paystack.service';
import { NoopPaystackService } from './noop-paystack.service';

@Global()
@Module({
  providers: [
    {
      provide: PAYSTACK_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('NODE_ENV') === 'prod'
          ? new PaystackService(config)
          : new NoopPaystackService(),
    },
  ],
  exports: [PAYSTACK_SERVICE],
})
export class PaystackModule {}
