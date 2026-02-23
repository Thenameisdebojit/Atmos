const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CarbonMarketplace - Unit Tests", function () {
  
  async function deployMarketplaceFixture() {
    const [owner, trader1, trader2, enterprise] = await ethers.getSigners();

    // Deploy dependencies
    const CarbonCreditNFT = await ethers.getContractFactory("CarbonCreditNFT");
    const nft = await CarbonCreditNFT.deploy();
    await nft.waitForDeployment();

    const CarbonCreditToken = await ethers.getContractFactory("CarbonCreditToken");
    const token = await CarbonCreditToken.deploy(
      "ATMOS Carbon Credit - Verra",
      "CCT-VCS",
      await nft.getAddress(),
      "VERRA_VCS"
    );
    await token.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();

    // Mint USDC to traders
    await usdc.mint(trader1.address, ethers.parseUnits("100000", 6));
    await usdc.mint(trader2.address, ethers.parseUnits("100000", 6));
    await usdc.mint(enterprise.address, ethers.parseUnits("500000", 6));

    // Deploy Marketplace
    const CarbonMarketplace = await ethers.getContractFactory("CarbonMarketplace");
    const marketplace = await CarbonMarketplace.deploy(
      await usdc.getAddress(),
      await token.getAddress(),
      await nft.getAddress()
    );
    await marketplace.waitForDeployment();

    // Setup roles
    const ISSUER_ROLE = await nft.ISSUER_ROLE();
    await nft.grantRole(ISSUER_ROLE, owner.address);

    const KYC_ROLE = await marketplace.KYC_ROLE();
    await marketplace.grantRole(KYC_ROLE, owner.address);

    // Mint and wrap some tokens for testing
    await nft.mintCredit(
      trader1.address,
      "PROJECT_001",
      "Test Project",
      "VCS-TEST-001",
      "VERRA_VCS",
      ethers.parseUnits("1000", 18),
      2024,
      "IN",
      ethers.keccak256(ethers.toUtf8Bytes("proof")),
      "cid",
      "ipfs://uri"
    );

    await nft.connect(trader1).approve(await token.getAddress(), 1);
    await token.connect(trader1).wrapCredit(1);

    return { marketplace, token, usdc, nft, owner, trader1, trader2, enterprise };
  }

  // ============ ORDER BOOK TESTS ============
  describe("Order Book - Buy Orders", function () {
    it("Should create a buy order", async function () {
      const { marketplace, usdc, trader2 } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("100", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);
      const totalCost = (BigInt(100) * BigInt(pricePerTonne)) / BigInt(1e12);

      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);

      const tx = await marketplace.connect(trader2).createBuyOrder(
        amount,
        pricePerTonne,
        3600, // 1 hour
        false
      );

      await expect(tx)
        .to.emit(marketplace, "OrderCreated")
        .withArgs(1, trader2.address, true, amount, pricePerTonne);

      const order = await marketplace.getOrder(1);
      expect(order.trader).to.equal(trader2.address);
      expect(order.isBuyOrder).to.be.true;
      expect(order.amount).to.equal(amount);
      expect(order.isActive).to.be.true;
    });

    it("Should reject buy order without sufficient USDC approval", async function () {
      const { marketplace, trader2 } = await loadFixture(deployMarketplaceFixture);

      await expect(
        marketplace.connect(trader2).createBuyOrder(
          ethers.parseUnits("100", 18),
          ethers.parseUnits("15", 6),
          3600,
          false
        )
      ).to.be.reverted;
    });

    it("Should lock USDC when buy order created", async function () {
      const { marketplace, usdc, trader2 } = await loadFixture(deployMarketplaceFixture);

      const balanceBefore = await usdc.balanceOf(trader2.address);
      const amount = ethers.parseUnits("100", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);
      const totalCost = (BigInt(100) * BigInt(pricePerTonne)) / BigInt(1e12);

      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);
      await marketplace.connect(trader2).createBuyOrder(amount, pricePerTonne, 3600, false);

      const balanceAfter = await usdc.balanceOf(trader2.address);
      expect(balanceBefore - balanceAfter).to.equal(totalCost);
    });
  });

  describe("Order Book - Sell Orders", function () {
    it("Should create a sell order", async function () {
      const { marketplace, token, trader1 } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("500", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);

      await token.connect(trader1).approve(await marketplace.getAddress(), amount);

      const tx = await marketplace.connect(trader1).createSellOrder(
        amount,
        pricePerTonne,
        3600,
        false
      );

      await expect(tx)
        .to.emit(marketplace, "OrderCreated")
        .withArgs(1, trader1.address, false, amount, pricePerTonne);
    });

    it("Should lock CCT tokens when sell order created", async function () {
      const { marketplace, token, trader1 } = await loadFixture(deployMarketplaceFixture);

      const balanceBefore = await token.balanceOf(trader1.address);
      const amount = ethers.parseUnits("500", 18);

      await token.connect(trader1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(trader1).createSellOrder(
        amount,
        ethers.parseUnits("15", 6),
        3600,
        false
      );

      const balanceAfter = await token.balanceOf(trader1.address);
      expect(balanceBefore - balanceAfter).to.equal(amount);
    });
  });

  describe("Order Filling", function () {
    it("Should fill a sell order", async function () {
      const { marketplace, token, usdc, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("500", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);

      // Create sell order
      await token.connect(trader1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(trader1).createSellOrder(amount, pricePerTonne, 3600, false);

      // Fill order
      const totalCost = (BigInt(500) * BigInt(pricePerTonne)) / BigInt(1e12);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);

      const tx = await marketplace.connect(trader2).fillOrder(1, amount);
      await expect(tx).to.emit(marketplace, "OrderFilled");

      expect(await token.balanceOf(trader2.address)).to.equal(amount);
    });

    it("Should support partial fills", async function () {
      const { marketplace, token, usdc, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("500", 18);
      const fillAmount = ethers.parseUnits("200", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);

      await token.connect(trader1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(trader1).createSellOrder(amount, pricePerTonne, 3600, false);

      const totalCost = (BigInt(200) * BigInt(pricePerTonne)) / BigInt(1e12);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);
      await marketplace.connect(trader2).fillOrder(1, fillAmount);

      const order = await marketplace.getOrder(1);
      expect(order.filled).to.equal(fillAmount);
      expect(order.isActive).to.be.true; // Still active for remaining amount
    });

    it("Should deactivate order when fully filled", async function () {
      const { marketplace, token, usdc, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("500", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);

      await token.connect(trader1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(trader1).createSellOrder(amount, pricePerTonne, 3600, false);

      const totalCost = (BigInt(500) * BigInt(pricePerTonne)) / BigInt(1e12);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);
      await marketplace.connect(trader2).fillOrder(1, amount);

      const order = await marketplace.getOrder(1);
      expect(order.isActive).to.be.false;
    });

    it("Should reject filling expired order", async function () {
      const { marketplace, token, usdc, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("500", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);

      await token.connect(trader1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(trader1).createSellOrder(amount, pricePerTonne, 10, false); // 10 seconds

      // Fast forward time
      await time.increase(11);

      const totalCost = (BigInt(500) * BigInt(pricePerTonne)) / BigInt(1e12);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);

      await expect(
        marketplace.connect(trader2).fillOrder(1, amount)
      ).to.be.revertedWith("Order expired");
    });
  });

  describe("Order Cancellation", function () {
    it("Should cancel active buy order and refund USDC", async function () {
      const { marketplace, usdc, trader2 } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("100", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);
      const totalCost = (BigInt(100) * BigInt(pricePerTonne)) / BigInt(1e12);

      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);
      await marketplace.connect(trader2).createBuyOrder(amount, pricePerTonne, 3600, false);

      const balanceBefore = await usdc.balanceOf(trader2.address);
      await marketplace.connect(trader2).cancelOrder(1);
      const balanceAfter = await usdc.balanceOf(trader2.address);

      expect(balanceAfter - balanceBefore).to.equal(totalCost);

      const order = await marketplace.getOrder(1);
      expect(order.isActive).to.be.false;
    });

    it("Should cancel active sell order and return CCT", async function () {
      const { marketplace, token, trader1 } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("500", 18);
      await token.connect(trader1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(trader1).createSellOrder(amount, ethers.parseUnits("15", 6), 3600, false);

      const balanceBefore = await token.balanceOf(trader1.address);
      await marketplace.connect(trader1).cancelOrder(1);
      const balanceAfter = await token.balanceOf(trader1.address);

      expect(balanceAfter - balanceBefore).to.equal(amount);
    });

    it("Should reject cancellation by non-creator", async function () {
      const { marketplace, token, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      await token.connect(trader1).approve(await marketplace.getAddress(), ethers.parseUnits("500", 18));
      await marketplace.connect(trader1).createSellOrder(
        ethers.parseUnits("500", 18),
        ethers.parseUnits("15", 6),
        3600,
        false
      );

      await expect(
        marketplace.connect(trader2).cancelOrder(1)
      ).to.be.revertedWith("Not order creator");
    });
  });

  // ============ AMM TESTS ============
  describe("AMM Liquidity Pool", function () {
    it("Should add initial liquidity", async function () {
      const { marketplace, token, usdc, trader1 } = await loadFixture(deployMarketplaceFixture);

      const carbonAmount = ethers.parseUnits("500", 18);
      const stableAmount = ethers.parseUnits("7500", 6);

      await token.connect(trader1).approve(await marketplace.getAddress(), carbonAmount);
      await usdc.connect(trader1).approve(await marketplace.getAddress(), stableAmount);

      const tx = await marketplace.connect(trader1).addLiquidity(carbonAmount, stableAmount);
      await expect(tx).to.emit(marketplace, "LiquidityAdded");

      const lpBalance = await marketplace.lpTokens(trader1.address);
      expect(lpBalance).to.be.greaterThan(0);
    });

    it("Should remove liquidity", async function () {
      const { marketplace, token, usdc, trader1 } = await loadFixture(deployMarketplaceFixture);

      const carbonAmount = ethers.parseUnits("500", 18);
      const stableAmount = ethers.parseUnits("7500", 6);

      await token.connect(trader1).approve(await marketplace.getAddress(), carbonAmount);
      await usdc.connect(trader1).approve(await marketplace.getAddress(), stableAmount);
      await marketplace.connect(trader1).addLiquidity(carbonAmount, stableAmount);

      const lpBalance = await marketplace.lpTokens(trader1.address);
      
      const tx = await marketplace.connect(trader1).removeLiquidity(lpBalance);
      await expect(tx).to.emit(marketplace, "LiquidityRemoved");
    });

    it("Should swap USDC for CCT", async function () {
      const { marketplace, token, usdc, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      // Add liquidity
      const carbonAmount = ethers.parseUnits("500", 18);
      const stableAmount = ethers.parseUnits("7500", 6);
      await token.connect(trader1).approve(await marketplace.getAddress(), carbonAmount);
      await usdc.connect(trader1).approve(await marketplace.getAddress(), stableAmount);
      await marketplace.connect(trader1).addLiquidity(carbonAmount, stableAmount);

      // Swap
      const swapAmount = ethers.parseUnits("100", 6);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), swapAmount);

      const balanceBefore = await token.balanceOf(trader2.address);
      await marketplace.connect(trader2).swap(false, swapAmount, 0);
      const balanceAfter = await token.balanceOf(trader2.address);

      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });

    it("Should swap CCT for USDC", async function () {
      const { marketplace, token, usdc, nft, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      // Add liquidity
      const carbonAmount = ethers.parseUnits("500", 18);
      const stableAmount = ethers.parseUnits("7500", 6);
      await token.connect(trader1).approve(await marketplace.getAddress(), carbonAmount);
      await usdc.connect(trader1).approve(await marketplace.getAddress(), stableAmount);
      await marketplace.connect(trader1).addLiquidity(carbonAmount, stableAmount);

      // Mint and wrap for trader2
      await nft.mintCredit(
        trader2.address,
        "PROJECT_002",
        "Test",
        "VCS-TEST-002",
        "VERRA_VCS",
        ethers.parseUnits("100", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );
      await nft.connect(trader2).approve(await token.getAddress(), 2);
      await token.connect(trader2).wrapCredit(2);

      // Swap
      const swapAmount = ethers.parseUnits("50", 18);
      await token.connect(trader2).approve(await marketplace.getAddress(), swapAmount);

      const balanceBefore = await usdc.balanceOf(trader2.address);
      await marketplace.connect(trader2).swap(true, swapAmount, 0);
      const balanceAfter = await usdc.balanceOf(trader2.address);

      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });

    it("Should reject swap with insufficient liquidity", async function () {
      const { marketplace, token, usdc, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      // Add small liquidity
      const carbonAmount = ethers.parseUnits("10", 18);
      const stableAmount = ethers.parseUnits("150", 6);
      await token.connect(trader1).approve(await marketplace.getAddress(), carbonAmount);
      await usdc.connect(trader1).approve(await marketplace.getAddress(), stableAmount);
      await marketplace.connect(trader1).addLiquidity(carbonAmount, stableAmount);

      // Try to swap more than available
      const swapAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), swapAmount);

      await expect(
        marketplace.connect(trader2).swap(false, swapAmount, 0)
      ).to.be.revertedWith("Insufficient liquidity");
    });

    it("Should enforce slippage protection", async function () {
      const { marketplace, token, usdc, trader1, trader2 } = await loadFixture(deployMarketplaceFixture);

      const carbonAmount = ethers.parseUnits("500", 18);
      const stableAmount = ethers.parseUnits("7500", 6);
      await token.connect(trader1).approve(await marketplace.getAddress(), carbonAmount);
      await usdc.connect(trader1).approve(await marketplace.getAddress(), stableAmount);
      await marketplace.connect(trader1).addLiquidity(carbonAmount, stableAmount);

      const swapAmount = ethers.parseUnits("100", 6);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), swapAmount);

      await expect(
        marketplace.connect(trader2).swap(false, swapAmount, ethers.parseUnits("1000", 18)) // Unrealistic min
      ).to.be.revertedWith("Slippage exceeded");
    });
  });

  // ============ KYC TESTS ============
  describe("KYC Gating", function () {
    it("Should create KYC-required order", async function () {
      const { marketplace, token, trader1, owner } = await loadFixture(deployMarketplaceFixture);

      await marketplace.connect(owner).setKYCStatus(trader1.address, true);

      await token.connect(trader1).approve(await marketplace.getAddress(), ethers.parseUnits("100", 18));
      await marketplace.connect(trader1).createSellOrder(
        ethers.parseUnits("100", 18),
        ethers.parseUnits("15", 6),
        3600,
        true // KYC required
      );

      const order = await marketplace.getOrder(1);
      expect(order.requiresKYC).to.be.true;
    });

    it("Should reject non-KYC user filling KYC order", async function () {
      const { marketplace, token, usdc, trader1, trader2, owner } = await loadFixture(deployMarketplaceFixture);

      await marketplace.connect(owner).setKYCStatus(trader1.address, true);

      await token.connect(trader1).approve(await marketplace.getAddress(), ethers.parseUnits("100", 18));
      await marketplace.connect(trader1).createSellOrder(
        ethers.parseUnits("100", 18),
        ethers.parseUnits("15", 6),
        3600,
        true
      );

      const totalCost = (BigInt(100) * BigInt(ethers.parseUnits("15", 6))) / BigInt(1e12);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);

      await expect(
        marketplace.connect(trader2).fillOrder(1, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("KYC required");
    });
  });

  // ============ PRICE QUERY TESTS ============
  describe("Price Discovery", function () {
    it("Should return current AMM price", async function () {
      const { marketplace, token, usdc, trader1 } = await loadFixture(deployMarketplaceFixture);

      const carbonAmount = ethers.parseUnits("1000", 18);
      const stableAmount = ethers.parseUnits("15000", 6);
      await token.connect(trader1).approve(await marketplace.getAddress(), carbonAmount);
      await usdc.connect(trader1).approve(await marketplace.getAddress(), stableAmount);
      await marketplace.connect(trader1).addLiquidity(carbonAmount, stableAmount);

      const price = await marketplace.getPrice();
      console.log(`      Current price: $${ethers.formatUnits(price, 18)} per tonne`);
      expect(price).to.be.greaterThan(0);
    });
  });

  // ============ FEE TESTS ============
  describe("Trading Fees", function () {
    it("Should collect 0.25% fee on trades", async function () {
      const { marketplace, token, usdc, trader1, trader2, owner } = await loadFixture(deployMarketplaceFixture);

      const amount = ethers.parseUnits("100", 18);
      const pricePerTonne = ethers.parseUnits("15", 6);
      const totalCost = (BigInt(100) * BigInt(pricePerTonne)) / BigInt(1e12);
      const expectedFee = (totalCost * BigInt(25)) / BigInt(10000); // 0.25%

      await token.connect(trader1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(trader1).createSellOrder(amount, pricePerTonne, 3600, false);

      const trader1BalanceBefore = await usdc.balanceOf(trader1.address);
      await usdc.connect(trader2).approve(await marketplace.getAddress(), totalCost);
      await marketplace.connect(trader2).fillOrder(1, amount);
      const trader1BalanceAfter = await usdc.balanceOf(trader1.address);

      const received = trader1BalanceAfter - trader1BalanceBefore;
      const fee = totalCost - received;

      console.log(`      Fee collected: ${ethers.formatUnits(fee, 6)} USDC`);
      expect(fee).to.be.closeTo(expectedFee, BigInt(1)); // Allow 1 unit rounding
    });
  });
});
