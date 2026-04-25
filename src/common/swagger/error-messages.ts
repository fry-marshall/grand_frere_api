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
  },
  SCHOOLS: {
    NOT_FOUND: 'School not found',
  },
} as const;
