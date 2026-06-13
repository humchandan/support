const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = new URL(process.env.DATABASE_URL);
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.replace(/^\//, '')
});
const prisma = new PrismaClient({ adapter });

console.log("Prisma Client Properties:", Object.keys(prisma).filter(k => !k.startsWith("_")));
prisma.$disconnect();
