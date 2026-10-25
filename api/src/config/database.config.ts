import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  trustServerCertificate: boolean;
  encrypt: boolean;
}

export default registerAs('database', (): DatabaseConfig => ({
  server: process.env.DB_SERVER ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 1433),
  database: process.env.DB_NAME ?? 'TransportPlanning',
  user: process.env.DB_USER ?? 'sa',
  password: process.env.DB_PASSWORD ?? '',
  trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  encrypt: process.env.DB_ENCRYPT !== 'false',
}));
