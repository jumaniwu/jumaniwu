import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('🚀 Deploying GRIYAKU contracts with account:', deployer.address);
  console.log('   Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'MATIC');

  // 1. Deploy PropertyFactory
  const PropertyFactory = await ethers.getContractFactory('PropertyFactory');
  const factory = await PropertyFactory.deploy(deployer.address);
  await factory.waitForDeployment();
  console.log('✅ PropertyFactory deployed to:', await factory.getAddress());

  // 2. Deploy YieldDistributor
  const YieldDistributor = await ethers.getContractFactory('YieldDistributor');
  const distributor = await YieldDistributor.deploy(deployer.address);
  await distributor.waitForDeployment();
  console.log('✅ YieldDistributor deployed to:', await distributor.getAddress());

  // 3. Deploy Marketplace
  const Marketplace = await ethers.getContractFactory('Marketplace');
  const marketplace = await Marketplace.deploy(deployer.address);
  await marketplace.waitForDeployment();
  console.log('✅ Marketplace deployed to:', await marketplace.getAddress());

  // 4. Deploy first property token (Villa Griyaku Canggu)
  // Price: IDR 10,000 ≈ 0.00058 MATIC (using mock rate for testnet)
  const tokenPriceWei = ethers.parseEther('0.00058');
  const totalSupply = 1_474_515n;

  const tx = await factory.deployPropertyToken(
    'Villa Griyaku Canggu Token',
    'VGCT',
    'villa-griyaku-canggu',
    totalSupply,
    tokenPriceWei
  );
  const receipt = await tx.wait();
  const propertyTokenAddress = await factory.getPropertyContract('villa-griyaku-canggu');
  console.log('✅ PropertyToken (Villa Griyaku Canggu) deployed to:', propertyTokenAddress);

  console.log('\n📋 Deployment Summary:');
  console.log('   PropertyFactory:', await factory.getAddress());
  console.log('   YieldDistributor:', await distributor.getAddress());
  console.log('   Marketplace:', await marketplace.getAddress());
  console.log('   Villa Griyaku Canggu Token:', propertyTokenAddress);
  console.log('\n⚠️  Save these addresses to your backend .env file!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
