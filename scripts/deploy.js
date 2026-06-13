const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ARES");

  // 1. Deploy AriesValidatorRegistry
  console.log("\n--- Deploying AriesValidatorRegistry ---");
  const initialValidators = [
    "0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17",
    "0x40a0cb1C63e026A81B55EE1308586E21eec1eFa9"
  ];
  // 51,000 ARES in wei (18 decimals)
  const stakeAmount = hre.ethers.parseEther("51000");
  const initialStakes = [stakeAmount, stakeAmount];

  const ValidatorRegistry = await hre.ethers.getContractFactory("AriesValidatorRegistry");
  const registry = await ValidatorRegistry.deploy(initialValidators, initialStakes, {
    // Optionally send some value if desired, but not strictly required
    value: hre.ethers.parseEther("0")
  });
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AriesValidatorRegistry deployed to:", registryAddress);

  // 2. Deploy AriesPortalWallet
  console.log("\n--- Deploying AriesPortalWallet ---");
  const masterWallet = "0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17"; // Node 1
  const PortalWallet = await hre.ethers.getContractFactory("AriesPortalWallet");
  const portal = await PortalWallet.deploy(masterWallet);
  await portal.waitForDeployment();
  const portalAddress = await portal.getAddress();
  console.log("AriesPortalWallet deployed to:", portalAddress);

  // 3. Deploy AriesGames
  console.log("\n--- Deploying AriesGames ---");
  const Games = await hre.ethers.getContractFactory("AriesGames");
  // Fund the games contract with 10,000 ARES for scratch card prizes
  const gamesFunding = hre.ethers.parseEther("10000");
  const games = await Games.deploy({ value: gamesFunding });
  await games.waitForDeployment();
  const gamesAddress = await games.getAddress();
  console.log("AriesGames deployed to:", gamesAddress);

  // 4. Save deployed addresses and ABIs to the frontend directory
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
  function saveContractArtifact(name, address, contractFactory) {
    const artifact = {
      address: address,
      abi: contractFactory.interface.fragments.map(f => JSON.parse(f.format("json")))
    };
    fs.writeFileSync(
      path.join(contractsDir, `${name}.json`),
      JSON.stringify(artifact, null, 2)
    );
    console.log(`Saved ${name} artifact to frontend/contracts/${name}.json`);
  }

  saveContractArtifact("AriesValidatorRegistry", registryAddress, registry);
  saveContractArtifact("AriesPortalWallet", portalAddress, portal);
  saveContractArtifact("AriesGames", gamesAddress, games);

  console.log("\nDeployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
