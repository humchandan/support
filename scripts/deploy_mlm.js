const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying MLM contracts with the account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ARES");

  // Node 1 address used as placeholder for master wallet, fee recipient, and signer key
  const adminAddress = "0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17";

  // 1. Deploy AriesSupportPortal
  console.log("\n--- Deploying AriesSupportPortal ---");
  const AriesSupportPortal = await hre.ethers.getContractFactory("AriesSupportPortal");
  const portal = await AriesSupportPortal.deploy(adminAddress, adminAddress);
  await portal.waitForDeployment();
  const portalAddress = await portal.getAddress();
  console.log("AriesSupportPortal deployed to:", portalAddress);

  // 2. Deploy PortalFactory
  console.log("\n--- Deploying PortalFactory ---");
  const PortalFactory = await hre.ethers.getContractFactory("PortalFactory");
  const factory = await PortalFactory.deploy(adminAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("PortalFactory deployed to:", factoryAddress);

  // 3. Save deployed addresses and ABIs to the frontend directory
  console.log("\n--- Writing deployment artifacts to frontend ---");
  const frontendDir = path.join(__dirname, "..", "frontend");
  const contractsDir = path.join(frontendDir, "contracts");

  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir);
  }
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  // Helper function to extract ABI and address
  function saveContractArtifact(name, address, contractInstance) {
    const artifact = {
      address: address,
      abi: contractInstance.interface.fragments.map(f => JSON.parse(f.format("json")))
    };
    fs.writeFileSync(
      path.join(contractsDir, `${name}.json`),
      JSON.stringify(artifact, null, 2)
    );
    console.log(`Saved ${name} artifact to frontend/contracts/${name}.json`);
  }

  saveContractArtifact("AriesSupportPortal", portalAddress, portal);
  saveContractArtifact("PortalFactory", factoryAddress, factory);

  console.log("\nMLM Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
