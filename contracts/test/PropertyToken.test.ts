import { expect } from 'chai';
import { ethers } from 'hardhat';
import { PropertyToken, PropertyFactory, YieldDistributor } from '../typechain-types';

describe('GRIYAKU Smart Contracts', () => {
  let factory: PropertyFactory;
  let distributor: YieldDistributor;
  let token: PropertyToken;
  let owner: any, investor1: any, investor2: any;

  const TOKEN_PRICE = ethers.parseEther('0.001'); // 0.001 MATIC per token
  const TOTAL_SUPPLY = 1_000_000n;

  beforeEach(async () => {
    [owner, investor1, investor2] = await ethers.getSigners();

    const FactoryFactory = await ethers.getContractFactory('PropertyFactory');
    factory = await FactoryFactory.deploy(owner.address);

    const DistributorFactory = await ethers.getContractFactory('YieldDistributor');
    distributor = await DistributorFactory.deploy(owner.address);

    await factory.deployPropertyToken('Test Villa Token', 'TVT', 'test-villa', TOTAL_SUPPLY, TOKEN_PRICE);
    const tokenAddr = await factory.getPropertyContract('test-villa');
    token = await ethers.getContractAt('PropertyToken', tokenAddr);
  });

  describe('PropertyFactory', () => {
    it('should deploy a property token', async () => {
      expect(await factory.totalProperties()).to.equal(1n);
    });

    it('should not allow duplicate property deployments', async () => {
      await expect(
        factory.deployPropertyToken('Duplicate', 'DUP', 'test-villa', TOTAL_SUPPLY, TOKEN_PRICE)
      ).to.be.revertedWith('Property already deployed');
    });
  });

  describe('PropertyToken - Purchase', () => {
    it('should allow buying tokens', async () => {
      const amount = 100n;
      const cost = TOKEN_PRICE * amount;

      await token.connect(investor1).buyTokens(amount, { value: cost });
      expect(await token.balanceOf(investor1.address)).to.equal(amount);
    });

    it('should refund excess MATIC', async () => {
      const amount = 100n;
      const cost = TOKEN_PRICE * amount;
      const excess = ethers.parseEther('1');

      const balanceBefore = await ethers.provider.getBalance(investor1.address);
      const tx = await token.connect(investor1).buyTokens(amount, { value: cost + excess });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(investor1.address);
      expect(balanceBefore - balanceAfter - gasUsed).to.equal(cost);
    });

    it('should revert if insufficient MATIC sent', async () => {
      await expect(
        token.connect(investor1).buyTokens(100n, { value: ethers.parseEther('0.00001') })
      ).to.be.revertedWith('Insufficient MATIC sent');
    });
  });

  describe('PropertyToken - Yield Distribution', () => {
    it('should distribute yield proportionally', async () => {
      // investor1 buys 600, investor2 buys 400
      await token.connect(investor1).buyTokens(600n, { value: TOKEN_PRICE * 600n });
      await token.connect(investor2).buyTokens(400n, { value: TOKEN_PRICE * 400n });

      const yieldAmount = ethers.parseEther('1');
      await token.connect(owner).distributeYield({ value: yieldAmount });

      const pending1 = await token.pendingYield(investor1.address);
      const pending2 = await token.pendingYield(investor2.address);

      // investor1 has 60%, investor2 has 40%
      expect(pending1).to.be.closeTo(yieldAmount * 6n / 10n, ethers.parseEther('0.001'));
      expect(pending2).to.be.closeTo(yieldAmount * 4n / 10n, ethers.parseEther('0.001'));
    });

    it('should allow holders to claim yield', async () => {
      await token.connect(investor1).buyTokens(1000n, { value: TOKEN_PRICE * 1000n });
      const yieldAmount = ethers.parseEther('1');
      await token.connect(owner).distributeYield({ value: yieldAmount });

      const balanceBefore = await ethers.provider.getBalance(investor1.address);
      const tx = await token.connect(investor1).claimYield();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      expect(balanceAfter + gasUsed - balanceBefore).to.be.closeTo(yieldAmount, ethers.parseEther('0.001'));
    });
  });

  describe('YieldDistributor', () => {
    it('should distribute yield to a property', async () => {
      await token.connect(investor1).buyTokens(1000n, { value: TOKEN_PRICE * 1000n });
      const yieldAmount = ethers.parseEther('0.5');

      await distributor.connect(owner).distributeToProperty(await token.getAddress(), { value: yieldAmount });
      expect(await token.totalYieldDistributed()).to.equal(yieldAmount);
    });
  });
});
