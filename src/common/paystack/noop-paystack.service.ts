import type {
  IPaystackService,
  InitializeTransactionParams,
  InitializeTransactionResult,
} from './paystack.interface';

export class NoopPaystackService implements IPaystackService {
  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    return Promise.resolve({
      authorizationUrl: `https://checkout.paystack.com/noop/${params.reference}`,
      reference: params.reference,
    });
  }
}
