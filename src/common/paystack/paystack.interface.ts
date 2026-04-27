export const PAYSTACK_SERVICE = 'PAYSTACK_SERVICE';

export interface InitializeTransactionParams {
  amount: number;
  email: string;
  reference: string;
  currency: string;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  reference: string;
}

export interface IPaystackService {
  initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult>;
}
