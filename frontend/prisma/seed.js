const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured in env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MLM_TIERS = [
  { name: "Default", minSelfInvestment: 100, minDirects: 0, minTeamVolume: 0, unlockedLevels: 1 },
  { name: "Bronze Leader", minSelfInvestment: 2000, minDirects: 2, minTeamVolume: 10000, unlockedLevels: 3 },
  { name: "Silver Leader", minSelfInvestment: 5000, minDirects: 4, minTeamVolume: 50000, unlockedLevels: 5 },
  { name: "Gold Leader", minSelfInvestment: 10000, minDirects: 6, minTeamVolume: 150000, unlockedLevels: 7 },
  { name: "Diamond Leader", minSelfInvestment: 25000, minDirects: 8, minTeamVolume: 500000, unlockedLevels: 9 },
  { name: "Crown Leader", minSelfInvestment: 50000, minDirects: 10, minTeamVolume: 1000000, unlockedLevels: 10 }
];

const MLM_LEVELS = [
  { level: 1, bonus: 8.0, requiredRank: "Default" },
  { level: 2, bonus: 4.0, requiredRank: "Bronze Leader" },
  { level: 3, bonus: 2.0, requiredRank: "Bronze Leader" },
  { level: 4, bonus: 1.5, requiredRank: "Silver Leader" },
  { level: 5, bonus: 1.0, requiredRank: "Silver Leader" },
  { level: 6, bonus: 1.0, requiredRank: "Gold Leader" },
  { level: 7, bonus: 0.75, requiredRank: "Gold Leader" },
  { level: 8, bonus: 0.75, requiredRank: "Diamond Leader" },
  { level: 9, bonus: 0.5, requiredRank: "Diamond Leader" },
  { level: 10, bonus: 0.5, requiredRank: "Crown Leader" }
];

const UTILITY_CATALOG = [
  {
    name: "Mobile Recharge",
    icon: "fa-mobile-screen",
    services: [
      { name: "Aries Mobile", description: "Instant Aries network mobile talktime and data top-up", minAmount: 1, maxAmount: 500 },
      { name: "Aries Talk", description: "Aries VOIP calling credits", minAmount: 5, maxAmount: 100 }
    ]
  },
  {
    name: "Utility Bills",
    icon: "fa-bolt",
    services: [
      { name: "Aries Power", description: "Electricity utility invoice payment", minAmount: 10, maxAmount: 1000 },
      { name: "Aries Gas", description: "Gas pipeline utility bill payment", minAmount: 10, maxAmount: 500 }
    ]
  },
  {
    name: "Broadband & ISP",
    icon: "fa-wifi",
    services: [
      { name: "Aries Fiber", description: "High-speed broadband monthly subscription renewal", minAmount: 20, maxAmount: 300 }
    ]
  },
  {
    name: "Vouchers & Gift Cards",
    icon: "fa-gift",
    services: [
      { name: "Amazon Gift Card", description: "Universal digital gift card for Amazon marketplace shopping", minAmount: 10, maxAmount: 1000 },
      { name: "Google Play Voucher", description: "Voucher for Android apps, games, and media store", minAmount: 10, maxAmount: 200 },
      { name: "Apple Vouchers", description: "Apple Store and Apple Music digital voucher code", minAmount: 10, maxAmount: 500 }
    ]
  }
];

async function main() {
  console.log("Starting database seed...");

  // 1. Seed MLM Tiers
  console.log("Seeding MLM Tiers...");
  for (const tier of MLM_TIERS) {
    await prisma.mlmTier.upsert({
      where: { name: tier.name },
      update: tier,
      create: tier
    });
  }

  // 2. Seed MLM Levels
  console.log("Seeding MLM Levels...");
  for (const lvl of MLM_LEVELS) {
    await prisma.mlmLevel.upsert({
      where: { level: lvl.level },
      update: lvl,
      create: lvl
    });
  }

  // 3. Seed Utility Catalog
  console.log("Seeding Utility Catalog...");
  for (const cat of UTILITY_CATALOG) {
    const dbCat = await prisma.utilityCategory.upsert({
      where: { name: cat.name },
      update: { icon: cat.icon },
      create: { name: cat.name, icon: cat.icon }
    });

    for (const svc of cat.services) {
      // Find service in this category or create
      const existing = await prisma.utilityService.findFirst({
        where: { name: svc.name, categoryId: dbCat.id }
      });

      if (existing) {
        await prisma.utilityService.update({
          where: { id: existing.id },
          data: svc
        });
      } else {
        await prisma.utilityService.create({
          data: {
            categoryId: dbCat.id,
            ...svc
          }
        });
      }
    }
  }

  console.log("Database seed completed successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
