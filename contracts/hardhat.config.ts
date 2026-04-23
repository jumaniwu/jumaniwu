import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || '0x' + '0'.repeat(64);
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    polygonMumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [ADMIN_PRIVATE_KEY],
      chainId: 80001,
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [ADMIN_PRIVATE_KEY],
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: { polygonMumbai: process.env.POLYGONSCAN_API_KEY || '', polygon: process.env.POLYGONSCAN_API_KEY || '' },
  },
};

export default config;
