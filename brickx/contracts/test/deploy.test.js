const { expect } = require("chai");
const { ethers } = require("hardhat");

// Verifies the full deploy wires every contract together correctly and that
// the genesis mint is exactly 1,000,000,000 BRX to the deployer.
describe("BRICKX deployment", function () {
  it("deploys all 5 contracts wired correctly with full BRX supply", async function () {
    const [deployer, treasury] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    const usdc = await Mock.deploy("USDC", "USDC", 6);
    await usdc.waitForDeployment();
    const usdt = await Mock.deploy("USDT", "USDT", 6);
    await usdt.waitForDeployment();
    const usdcA = await usdc.getAddress();
    const usdtA = await usdt.getAddress();

    // Predict the circular addresses exactly as the deploy script does.
    const n = await deployer.getNonce();
    const tokenAddr = ethers.getCreateAddress({ from: deployer.address, nonce: n });
    const vestingAddr = ethers.getCreateAddress({ from: deployer.address, nonce: n + 1 });
    const vaultAddr = ethers.getCreateAddress({ from: deployer.address, nonce: n + 2 });

    const token = await (await ethers.getContractFactory("BRXToken")).deploy(vestingAddr, vaultAddr);
    await token.waitForDeployment();
    const vesting = await (await ethers.getContractFactory("BRXVesting")).deploy(tokenAddr);
    await vesting.waitForDeployment();
    const vault = await (await ethers.getContractFactory("BRXICOVault")).deploy(treasury.address, usdcA, usdtA, tokenAddr, vestingAddr);
    await vault.waitForDeployment();
    const brick = await (await ethers.getContractFactory("BRICKToken")).deploy(usdcA, treasury.address);
    await brick.waitForDeployment();
    const brickAddr = await brick.getAddress();
    const yieldD = await (await ethers.getContractFactory("YieldDistributor")).deploy(usdcA, brickAddr, treasury.address);
    await yieldD.waitForDeployment();

    // Predicted addresses held
    expect(await token.getAddress()).to.equal(tokenAddr);
    expect(await vesting.getAddress()).to.equal(vestingAddr);
    expect(await vault.getAddress()).to.equal(vaultAddr);

    // Genesis supply
    const ONE_B = ethers.parseUnits("1000000000", 18);
    expect(await token.totalSupply()).to.equal(ONE_B);
    expect(await token.balanceOf(deployer.address)).to.equal(ONE_B);

    // Cross-wiring
    expect(await token.vestingContract()).to.equal(vestingAddr);
    expect(await token.icoVault()).to.equal(vaultAddr);
    expect(await vesting.token()).to.equal(tokenAddr);
    expect(await vault.brxToken()).to.equal(tokenAddr);
    expect(await vault.vestingContract()).to.equal(vestingAddr);
    expect(await yieldD.brickToken()).to.equal(brickAddr);
  });
});
