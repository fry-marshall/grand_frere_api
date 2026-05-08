import * as Joi from 'joi';

const optionalString = Joi.string().allow('').optional();
const prodRequired = Joi.string().when('NODE_ENV', {
  is: 'prod',
  then: Joi.required(),
  otherwise: optionalString,
});

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('dev', 'test', 'prod').required(),
  PORT: Joi.number().default(3000),
  ALLOWED_ORIGINS: optionalString,
  DATABASE_URL: Joi.string().required(),
  ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_EXPIRY: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: Joi.string().default('7d'),

  DO_SPACES_ENDPOINT: prodRequired,
  DO_SPACES_REGION: prodRequired,
  DO_SPACES_KEY: prodRequired,
  DO_SPACES_SECRET: prodRequired,
  DO_SPACES_BUCKET: prodRequired,

  /* FIREBASE_PROJECT_ID: prodRequired,
  FIREBASE_PRIVATE_KEY: prodRequired,
  FIREBASE_CLIENT_EMAIL: Joi.string().email().allow('').when('NODE_ENV', {
    is: 'prod',
    then: Joi.required(),
    otherwise: optionalString,
  }), */

  /* MAIL_HOST: prodRequired, */
  MAIL_PORT: Joi.number().default(587),
  /* MAIL_USER: prodRequired,
  MAIL_PASSWORD: prodRequired, */
  MAIL_FROM: Joi.string().email().default('noreply@example.com'),

  /* TWILIO_ACCOUNT_SID: prodRequired,
  TWILIO_AUTH_TOKEN: prodRequired,
  TWILIO_PHONE_NUMBER: prodRequired, */

  /* PAYSTACK_SECRET_KEY: prodRequired, */
});
