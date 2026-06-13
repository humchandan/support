const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const RPC_URL = process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'http://127.0.0.1:8545';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current Block Height: ${currentBlock}`);

  console.log("Querying all logs from block 1 to latest...");
  const logs = await provider.getLogs({
    fromBlock: 1,
    toBlock: currentBlock
  });

  console.log(`Found ${logs.length} logs:`);
  for (const log of logs) {
    console.log(`\nBlock #${log.blockNumber} | Tx Hash: ${log.transactionHash}`);
    console.log(`Contract Address: ${log.address}`);
    console.log(`Topics:`, log.topics);
    console.log(`Data:`, log.data);
  }
}

main().catch(console.error);
