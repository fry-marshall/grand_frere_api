import { ConfigService } from '@nestjs/config';
import type {
  IPaystackService,
  InitializeTransactionParams,
  InitializeTransactionResult,
} from './paystack.interface';

export class PaystackService implements IPaystackService {
  constructor(private readonly configService: ConfigService) {}

  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount,
        email: params.email,
        reference: params.reference,
        currency: params.currency,
      }),
    });

    if (!res.ok) {
      throw new Error(`Paystack error: ${res.status}`);
    }

    const body = (await res.json()) as {
      data: { authorization_url: string; reference: string };
    };

    return {
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference,
    };
  }
}
