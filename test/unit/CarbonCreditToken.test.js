const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CarbonCreditToken - Unit Tests", function () {
  
  async function deployTokenFixture() {
    const [owner, issuer, user1, user2] = await ethers.getSigners();

    // Deploy NFT contract first
    const CarbonCreditNFT = await ethers.getContractFactory("CarbonCreditNFT");
    const nft = await CarbonCreditNFT.deploy();
    await nft.waitForDeployment();

    const ISSUER_ROLE = await nft.ISSUER_ROLE();
    await nft.grantRole(ISSUER_ROLE, issuer.address);

    // Deploy Token wrapper
    const CarbonCreditToken = await ethers.getContractFactory("CarbonCreditToken");
    const token = await CarbonCreditToken.deploy(
      "ATMOS Carbon Credit - Verra",
      "CCT-VCS",
      await nft.getAddress(),
      "VERRA_VCS"
    );
    await token.waitForDeployment();

    return { nft, token, owner, issuer, user1, user2, ISSUER_ROLE };
  }

  // ============ DEPLOYMENT TESTS ============
  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { token, nft } = await loadFixture(deployTokenFixture);

      expect(await token.name()).to.equal("ATMOS Carbon Credit - Verra");
      expect(await token.symbol()).to.equal("CCT-VCS");
      expect(await token.decimals()).to.equal(18);
      expect(await token.methodology()).to.equal("VERRA_VCS");
      expect(await token.nftContract()).to.equal(await nft.getAddress());
    });

    it("Should initialize with zero supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.totalSupply()).to.equal(0);
    });
  });

  // ============ WRAPPING TESTS ============
  describe("Credit Wrapping", function () {
    it("Should wrap NFT into fungible tokens", async function () {
      const { nft, token, issuer, user1 } = await loadFixture(deployTokenFixture);

      // Mint NFT
      await nft.connect(issuer).mintCredit(
        user1.address,
        "PROJECT_001",
        "Test",
        "VCS-12345",
        "VERRA_VCS",
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      // Approve token contract
      await nft.connect(user1).approve(await token.getAddress(), 1);

      // Wrap
      const tx = await token.connect(user1).wrapCredit(1);
      await expect(tx)
        .to.emit(token, "CreditWrapped")
        .withArgs(user1.address, 1, ethers.parseUnits("1000", 18));

      // Check balances
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("1000", 18));
      expect(await nft.ownerOf(1)).to.equal(await token.getAddress());
    });

    it("Should reject wrapping already wrapped NFT", async function () {
      const { nft, token, issuer, user1 } = await loadFixture(deployTokenFixture);

      await nft.connect(issuer).mintCredit(
        user1.address,
        "PROJECT_001",
        "Test",
        "VCS-12345",
        "VERRA_VCS",
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      await nft.connect(user1).approve(await token.getAddress(), 1);
      await token.connect(user1).wrapCredit(1);

      await expect(token.connect(user1).wrapCredit(1)).to.be.revertedWith("Already wrapped");
    });

    it("Should reject wrapping wrong methodology", async function () {
      const { nft, token, issuer, user1 } = await loadFixture(deployTokenFixture);

      await nft.connect(issuer).mintCredit(
        user1.address,
        "PROJECT_001",
        "Test",
        "GS-12345",
        "GOLD_STANDARD", // Wrong methodology
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      await nft.connect(user1).approve(await token.getAddress(), 1);
      await expect(token.connect(user1).wrapCredit(1)).to.be.revertedWith("Methodology mismatch");
    });
  });

  // ============ BATCH WRAPPING TESTS ============
  describe("Batch Wrapping", function () {
    it("Should batch wrap multiple NFTs", async function () {
      const { nft, token, issuer, user1 } = await loadFixture(deployTokenFixture);

      // Mint 3 NFTs
      for (let i = 1; i <= 3; i++) {
        await nft.connect(issuer).mintCredit(
          user1.address,
          `PROJECT_00${i}`,
          "Test",
          `VCS-1234${i}`,
          "VERRA_VCS",
          ethers.parseUnits("100", 18),
          2024,
          "IN",
          ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
          "cid",
          "ipfs://uri"
        );
        await nft.connect(user1).approve(await token.getAddress(), i);
      }

      const tx = await token.connect(user1).batchWrap([1, 2, 3]);
      await expect(tx).to.emit(token, "BatchWrapped");

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("300", 18));
    });
  });

  // ============ UNWRAPPING TESTS ============
  describe("Credit Unwrapping", function () {
    it("Should unwrap specific NFT", async function () {
      const { nft, token, issuer, user1 } = await loadFixture(deployTokenFixture);

      await nft.connect(issuer).mintCredit(
        user1.address,
        "PROJECT_001",
        "Test",
        "VCS-12345",
        "VERRA_VCS",
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      await nft.connect(user1).approve(await token.getAddress(), 1);
      await token.connect(user1).wrapCredit(1);

      // Unwrap
      const tx = await token.connect(user1).unwrapCredit(1);
      await expect(tx)
        .to.emit(token, "CreditUnwrapped")
        .withArgs(user1.address, 1, ethers.parseUnits("1000", 18));

      expect(await token.balanceOf(user1.address)).to.equal(0);
      expect(await nft.ownerOf(1)).to.equal(user1.address);
    });

    it("Should reject unwrapping without sufficient balance", async function () {
      const { nft, token, issuer, user1, user2 } = await loadFixture(deployTokenFixture);

      await nft.connect(issuer).mintCredit(
        user1.address,
        "PROJECT_001",
        "Test",
        "VCS-12345",
        "VERRA_VCS",
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      await nft.connect(user1).approve(await token.getAddress(), 1);
      await token.connect(user1).wrapCredit(1);

      // user2 has no tokens
      await expect(token.connect(user2).unwrapCredit(1)).to.be.revertedWith("Insufficient CCT balance");
    });
  });

  // ============ BACKING TRANSPARENCY TESTS ============
  describe("Backing Transparency", function () {
    it("Should verify 1:1 backing ratio", async function () {
      const { nft, token, issuer, user1 } = await loadFixture(deployTokenFixture);

      await nft.connect(issuer).mintCredit(
        user1.address,
        "PROJECT_001",
        "Test",
        "VCS-12345",
        "VERRA_VCS",
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      await nft.connect(user1).approve(await token.getAddress(), 1);
      await token.connect(user1).wrapCredit(1);

      expect(await token.isFullyBacked()).to.be.true;

      const backing = await token.getBackingInfo();
      expect(backing.nftsLocked).to.equal(1);
      expect(backing.tonnesLocked).to.equal(ethers.parseUnits("1000", 18));
      expect(backing.tokensCirculating).to.equal(ethers.parseUnits("1000", 18));
    });

    it("Should track user wrapped NFTs", async function () {
      const { nft, token, issuer, user1 } = await loadFixture(deployTokenFixture);

      for (let i = 1; i <= 2; i++) {
        await nft.connect(issuer).mintCredit(
          user1.address,
          `PROJECT_00${i}`,
          "Test",
          `VCS-1234${i}`,
          "VERRA_VCS",
          ethers.parseUnits("100", 18),
          2024,
          "IN",
          ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
          "cid",
          "ipfs://uri"
        );
        await nft.connect(user1).approve(await token.getAddress(), i);
        await token.connect(user1).wrapCredit(i);
      }

      const wrappedNFTs = await token.getUserWrappedNFTs(user1.address);
      expect(wrappedNFTs.length).to.equal(2);
      expect(wrappedNFTs[0]).to.equal(1);
      expect(wrappedNFTs[1]).to.equal(2);
    });
  });

  // ============ ERC20 FUNCTIONALITY TESTS ============
  describe("ERC20 Standard Functions", function () {
    it("Should transfer tokens between users", async function () {
      const { nft, token, issuer, user1, user2 } = await loadFixture(deployTokenFixture);

      await nft.connect(issuer).mintCredit(
        user1.address,
        "PROJECT_001",
        "Test",
        "VCS-12345",
        "VERRA_VCS",
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      await nft.connect(user1).approve(await token.getAddress(), 1);
      await token.connect(user1).wrapCredit(1);

      await token.connect(user1).transfer(user2.address, ethers.parseUnits("500", 18));

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("500", 18));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseUnits("500", 18));
    });

    it("Should approve and transferFrom", async function () {
      const { nft, token, issuer, user1, user2 } = await loadFixture(deployTokenFixture);

      await nft.connect(issuer).mintCredit(
        user1.address,
        "PROJECT_001",
        "Test",
        "VCS-12345",
        "VERRA_VCS",
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      await nft.connect(user1).approve(await token.getAddress(), 1);
      await token.connect(user1).wrapCredit(1);

      await token.connect(user1).approve(user2.address, ethers.parseUnits("500", 18));
      await token.connect(user2).transferFrom(user1.address, user2.address, ethers.parseUnits("500", 18));

      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseUnits("500", 18));
    });
  });
});
