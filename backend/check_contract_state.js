const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
const RPC_URL = process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'http://127.0.0.1:8545';
const userAddress = '0x893d7c3c1af5aa8091cc1d8ce28a12571a4d61ab';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  const portalJsonPath = path.join(__dirname, '../frontend/public/contracts/AriesSupportPortal.json');
  const portalJson = JSON.parse(fs.readFileSync(portalJsonPath, 'utf8'));
  const contract = new ethers.Contract(portalJson.address, portalJson.abi, provider);

  console.log("Contract Address:", portalJson.address);
  
  try {
    const plan = await contract.userPlans(userAddress);
    console.log(`On-chain Plan State for ${userAddress}:`);
    console.log(`- totalDeposited: ${ethers.formatEther(plan.totalDeposited)} ARES`);
    console.log(`- totalClaimed: ${ethers.formatEther(plan.totalClaimed)} ARES`);
  } catch (err) {
    console.error("Failed to read user plan from contract:", err);
  }
}

main().catch(console.error);
