const { Queue } = require('bullmq');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

const sweepQueue = new Queue('sweep-queue', { connection });

module.exports = {
  sweepQueue,
  connection,
};
