const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const resUsers = await client.query('SELECT * FROM "User"');
    console.log("Users in Database:");
    console.log(resUsers.rows);

    const resLedger = await client.query('SELECT * FROM "LedgerEntry"');
    console.log("Ledger Entries in Database:");
    console.log(resLedger.rows);

    const resStaking = await client.query('SELECT * FROM "StakingPlan"');
    console.log("Staking Plans in Database:");
    console.log(resStaking.rows);

    const resEarnings = await client.query('SELECT * FROM "NetworkEarning"');
    console.log("Network Earnings in Database:");
    console.log(resEarnings.rows);
  } catch (err) {
    console.error("Query error:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
