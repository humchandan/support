const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const dbUrl = new URL(process.env.DATABASE_URL);
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.replace(/^\//, '')
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== USERS ===");
  const users = await prisma.user.findMany();
  console.log(users);

  console.log("\n=== CLAIM HISTORY ===");
  const claims = await prisma.claimHistory.findMany();
  console.log(claims);

  console.log("\n=== STAKING PLANS ===");
  const plans = await prisma.stakingPlan.findMany();
  console.log(plans);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
