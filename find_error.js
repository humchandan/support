const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const contractsDir = path.join(__dirname, 'frontend/public/contracts');
const targetSelector = '0x8e724956';

async function main() {
  const files = fs.readdirSync(contractsDir);
  console.log(`Searching for selector ${targetSelector} in ${files.length} contracts...`);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(contractsDir, file);
    const contract = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!contract.abi) continue;
    
    for (const item of contract.abi) {
      if (item.type === 'error') {
        const inputs = item.inputs.map(i => i.type).join(',');
        const signature = `${item.name}(${inputs})`;
        const selector = ethers.id(signature).substring(0, 10);
        console.log(`Contract: ${file} | Error: ${signature} | Selector: ${selector}`);
        if (selector === targetSelector) {
          console.log(`*** MATCH FOUND in ${file}: ${signature} ***`);
        }
      }
    }
  }
}

main().catch(console.error);
