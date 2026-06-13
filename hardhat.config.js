require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "10000000000000000000000000" // 10M ARES/ETH
      }
    },
    aries: {
      url: "http://127.0.0.1:8545",
      accounts: ["741de4f8988ea941d3ff0287911ca4074e62b7d45c991a51186455366f10b544"]
    }
  }
};
