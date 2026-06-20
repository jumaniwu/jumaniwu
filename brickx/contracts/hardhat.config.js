require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { AMOY_RPC_URL, POLYGON_RPC_URL, PRIVATE_KEY, POLYGONSCAN_API_KEY } = process.env;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // viaIR avoids "stack too deep" on the larger contracts (ICO vault).
      viaIR: true,
    },
  },
  // Contracts live in ./src so node_modules is never on the compile path.
  paths: { sources: "./src" },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    amoy: {
      url: AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts,
    },
    polygon: {
      url: POLYGON_RPC_URL || "https://polygon-rpc.com",
      chainId: 137,
      accounts,
    },
  },
  etherscan: {
    // Used by `hardhat verify`. Get a key at polygonscan.com.
    apiKey: { polygonAmoy: POLYGONSCAN_API_KEY || "", polygon: POLYGONSCAN_API_KEY || "" },
  },
};
