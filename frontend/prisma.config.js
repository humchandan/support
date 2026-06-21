const fs = require('fs');
const path = require('path');
const { defineConfig } = require("prisma/config");

// Load .env file manually if process.env.DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
        if (match) {
          process.env.DATABASE_URL = match[1];
          break;
        }
      }
    }
  } catch (err) {
    console.error("Failed to load .env manually:", err);
  }
}

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
