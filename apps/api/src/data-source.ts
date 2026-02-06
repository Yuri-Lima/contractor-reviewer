import { DataSource } from 'typeorm';
import { resolve, join } from 'path';

// Get the source directory - works reliably with ts-node and TypeORM CLI
// Determine source directory based on current working directory
const getSourceDir = (): string => {
  const cwd = process.cwd();
  
  // If __dirname is available (CommonJS), use it
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  
  // Otherwise, resolve from process.cwd()
  // When running from apps/api directory
  if (cwd.includes('apps/api')) {
    return resolve(cwd.replace(/apps\/api.*$/, 'apps/api/src'));
  }
  
  // When running from project root
  if (cwd.endsWith('contractor-reviwer') || !cwd.includes('apps')) {
    return resolve(cwd, 'apps/api/src');
  }
  
  // Fallback: assume we're in src directory
  return resolve(cwd, 'src');
};

const sourceDir = getSourceDir();

// Load environment variables using Node's built-in support
// NestJS ConfigModule handles env loading at runtime, but for migrations we need dotenv
// Note: dotenv should be installed if running migrations standalone
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { config } = require('dotenv');
  // Try multiple possible .env locations
  const envPaths = [
    resolve(sourceDir, '../../.env'),
    resolve(sourceDir, '../../../.env'),
    resolve(process.cwd(), '.env'),
  ];
  envPaths.forEach((envPath) => {
    try {
      config({ path: envPath });
    } catch {
      // Ignore individual failures
    }
  });
} catch {
  // dotenv not available, assume env vars are set externally
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(sourceDir, '**/*.entity{.ts,.js}')],
  migrations: [join(sourceDir, 'migrations/*{.ts,.js}')],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
  // Note: pgvector 'vector' type columns are handled via transformers in entities
  // Vector similarity operations should use raw SQL queries
});
