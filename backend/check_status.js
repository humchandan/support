const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
const RPC_URL = process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'http://127.0.0.1:8545';
const userAddress = '0x893d7c3c1af5aa8091cc1d8ce28a12571a4d61ab';
const proxyAddress = '0xad110c4548486d0bb9578d4927714dc20671ee6c';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // 1. Check current block and connection
  const block = await provider.getBlockNumber();
  console.log("Current block:", block);

  // 2. Check proxy wallet contract code
  const proxyCode = await provider.getCode(proxyAddress);
  console.log(`Proxy wallet ${proxyAddress} code length:`, proxyCode.length);
  console.log(`Is proxy contract deployed?`, proxyCode !== '0x' && proxyCode !== '0x00');

  // 3. Check AriesSupportPortal contract and plan state
  const portalJsonPath = path.join(__dirname, '../frontend/public/contracts/AriesSupportPortal.json');
  const portalJson = JSON.parse(fs.readFileSync(portalJsonPath, 'utf8'));
  const contract = new ethers.Contract(portalJson.address, portalJson.abi, provider);
  console.log("Portal contract address:", portalJson.address);
  
  const plan = await contract.userPlans(userAddress);
  console.log(`On-chain Plan State for ${userAddress}:`);
  console.log(`- totalDeposited: ${ethers.formatEther(plan.totalDeposited)} ARES`);
  console.log(`- totalClaimed: ${ethers.formatEther(plan.totalClaimed)} ARES`);

  // 4. Check trusted signer and fee recipient
  const signer = await contract.trustedSigner();
  const feeRecipient = await contract.feeRecipient();
  console.log("- Trusted Signer:", signer);
  console.log("- Fee Recipient:", feeRecipient);
}

main().catch(console.error);
