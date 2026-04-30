export const ErrorMessages = {
  AUTH: {
    PHONE_ALREADY_EXISTS: 'Phone already exists',
    INVALID_CREDENTIALS: 'Invalid credentials',
    TOKEN_EXPIRED: 'Token expired',
    INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token',
    CARD_NOT_ACTIVE: 'Card is not active',
    CARD_NOT_AVAILABLE: 'Card is not available for registration',
    CARD_HAS_NO_STUDENT: 'No student is linked to this card',
    STUDENT_ALREADY_HAS_TWO_PARENTS: 'Student already has two parents',
    PARENT_ALREADY_LINKED: 'Parent already linked to this student',
  },
  USERS: {
    NOT_FOUND: 'User not found',
  },
  CARDS: {
    NOT_FOUND: 'Card not found',
    CODE_ALREADY_EXISTS: 'Card code already exists',
    NOT_SUSPENDABLE: 'Card can only be suspended when active',
    NOT_ACTIVATABLE: 'Card can only be activated when suspended',
    DAILY_LIMIT_FORBIDDEN: 'Only the linked parent can update the daily limit',
    NOT_ACTIVE: 'Card is not active',
    PIN_NOT_SET: 'Card PIN is not set',
    PIN_INVALID: 'Invalid PIN',
    CARD_BLOCKED: 'Card is blocked after 3 failed PIN attempts',
    INVALID_PASSWORD: 'Invalid password',
  },
  SCHOOLS: {
    NOT_FOUND: 'School not found',
    SIGLE_ALREADY_EXISTS: 'School sigle already exists',
    NOT_SUSPENDABLE: 'School can only be suspended when active',
    NOT_ACTIVATABLE: 'School can only be activated when suspended',
  },
  STUDENTS: {
    NOT_FOUND: 'Student not found',
  },
  PARENTS: {
    NOT_FOUND: 'Parent not found',
  },
  ITEMS: {
    NOT_FOUND: 'Item not found',
  },
  WALLETS: {
    NOT_FOUND: 'Wallet not found',
  },
  PAYMENTS: {
    NOT_FOUND: 'Payment not found',
    INITIATION_FAILED: 'Payment initiation failed',
    INVALID_WEBHOOK_SIGNATURE: 'Invalid webhook signature',
  },
  ORDERS: {
    NOT_FOUND: 'Order not found',
    INSUFFICIENT_BALANCE: 'Insufficient wallet balance',
    DAILY_LIMIT_EXCEEDED: 'Daily spending limit exceeded',
    INVALID_ITEMS: 'One or more items are invalid or unavailable',
    NOT_PENDING: 'Order is not in pending status',
  },
  WITHDRAWALS: {
    NOT_FOUND: 'Withdrawal not found',
    INSUFFICIENT_BALANCE: 'Insufficient vendor wallet balance',
    NOT_PENDING: 'Withdrawal is not in pending status',
    NOT_IN_PROGRESS: 'Withdrawal is not in progress status',
  },
  VENDORS: {
    NOT_FOUND: 'Vendor not found',
    NOT_APPROVABLE: 'Vendor can only be approved when pending',
    NOT_REJECTABLE: 'Vendor can only be rejected when pending',
    WALLET_NOT_FOUND: 'Vendor wallet not found',
  },
} as const;
