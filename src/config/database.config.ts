import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

export const databaseConfig = registerAs(
  'database',
  (): DataSourceOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'dev',
    ssl: process.env.NODE_ENV === 'prod' ? { rejectUnauthorized: true } : false,
  }),
);
