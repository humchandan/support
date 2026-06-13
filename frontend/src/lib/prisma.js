import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = global;

const getClient = () => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const dbUrl = new URL(process.env.DATABASE_URL);
  const adapter = new PrismaMariaDb({
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port) || 3306,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.replace(/^\//, '')
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = getClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
