import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

interface CustomGlobal {
  prisma?: PrismaClient;
}

const globalForPrisma = global as unknown as CustomGlobal;

const getClient = (): PrismaClient => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/db';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = getClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
