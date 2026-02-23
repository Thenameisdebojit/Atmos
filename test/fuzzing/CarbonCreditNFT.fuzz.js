const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CarbonCreditNFT - Fuzzing Tests", function () {
  
  async function deployNFTFixture() {
    const [owner, issuer, user] = await ethers.getSigners();

    const CarbonCreditNFT = await ethers.getContractFactory("CarbonCreditNFT");
    const nft = await CarbonCreditNFT.deploy();
    await nft.waitForDeployment();

    const ISSUER_ROLE = await nft.ISSUER_ROLE();
    await nft.grantRole(ISSUER_ROLE, issuer.address);

    return { nft, owner, issuer, user };
  }

  // ============ RANDOM INPUT FUZZING ============
  describe("Random Input Fuzzing", function () {
    it("Should handle random co2Tonnes values", async function () {
      const { nft, issuer, user } = await loadFixture(deployNFTFixture);

      const testCases = 100;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < testCases; i++) {
        const randomTonnes = ethers.parseUnits(
          Math.floor(Math.random() * 100000).toString(),
          18
        );

        try {
          await nft.connect(issuer).mintCredit(
            user.address,
            `PROJECT_FUZZ_${i}`,
            "Fuzz Test",
            `FUZZ-${i}`,
            "VERRA_VCS",
            randomTonnes,
            2024,
            "IN",
            ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
            "cid",
            "ipfs://uri"
          );
          successCount++;
        } catch (error) {
          if (randomTonnes === BigInt(0)) {
            failCount++; // Expected to fail for 0 tonnes
          } else {
            throw error; // Unexpected failure
          }
        }
      }

      console.log(`      Success: ${successCount}/${testCases}`);
      console.log(`      Expected failures (0 tonnes): ${failCount}/${testCases}`);
      expect(successCount + failCount).to.equal(testCases);
    });

    it("Should handle random vintage years", async function () {
      const { nft, issuer, user } = await loadFixture(deployNFTFixture);

      const testCases = [
        { year: 2015, shouldPass: true },
        { year: 2020, shouldPass: true },
        { year: 2024, shouldPass: true },
        { year: 2030, shouldPass: true },
        { year: 2050, shouldPass: true },
        { year: 2000, shouldPass: false },
        { year: 2051, shouldPass: false },
        { year: 1990, shouldPass: false },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        if (testCase.shouldPass) {
          await expect(
            nft.connect(issuer).mintCredit(
              user.address,
              `PROJECT_YEAR_${i}`,
              "Test",
              `YEAR-${i}`,
              "VERRA_VCS",
              ethers.parseUnits("1000", 18),
              testCase.year,
              "IN",
              ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
              "cid",
              "ipfs://uri"
            )
          ).to.not.be.reverted;
        } else {
          await expect(
            nft.connect(issuer).mintCredit(
              user.address,
              `PROJECT_YEAR_${i}`,
              "Test",
              `YEAR-${i}`,
              "VERRA_VCS",
              ethers.parseUnits("1000", 18),
              testCase.year,
              "IN",
              ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
              "cid",
              "ipfs://uri"
            )
          ).to.be.revertedWith("Invalid vintage year");
        }
      }
    });

    it("Should handle random string inputs", async function () {
      const { nft, issuer, user } = await loadFixture(deployNFTFixture);

      const randomStrings = [
        "PROJECT_" + "A".repeat(100), // Long string
        "PROJECT_" + "🌍🔥💚", // Emoji
        "PROJECT_" + "\n\t", // Whitespace
        "PROJECT_" + "!@#$%^&*()", // Special chars
        "",
        "A",
      ];

      for (let i = 0; i < randomStrings.length; i++) {
        const projectId = randomStrings[i];
        
        if (projectId.length > 0) {
          await expect(
            nft.connect(issuer).mintCredit(
              user.address,
              projectId,
              "Test",
              `SERIAL-${i}`,
              "VERRA_VCS",
              ethers.parseUnits("1000", 18),
              2024,
              "IN",
              ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
              "cid",
              "ipfs://uri"
            )
          ).to.not.be.reverted;
        } else {
          // Empty string should fail validation
          await expect(
            nft.connect(issuer).mintCredit(
              user.address,
              projectId,
              "Test",
              `SERIAL-${i}`,
              "VERRA_VCS",
              ethers.parseUnits("1000", 18),
              2024,
              "IN",
              ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
              "cid",
              "ipfs://uri"
            )
          ).to.be.reverted;
        }
      }
    });
  });

  // ============ BATCH OPERATION STRESS TESTS ============
  describe("Batch Operation Stress Tests", function () {
    it("Should handle maximum batch size", async function () {
      this.timeout(60000); // 1 minute

      const { nft, issuer, user } = await loadFixture(deployNFTFixture);

      const maxBatchSize = 100;
      const credits = Array(maxBatchSize).fill(0).map((_, i) => ({
        projectName: `Batch Credit ${i}`,
        serialNumber: `BATCH-MAX-${i}`,
        methodology: "VERRA_VCS",
        co2Tonnes: ethers.parseUnits("100", 18),
        vintageYear: 2024,
        geography: "IN",
        oracleProofHash: ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
        satelliteDataCID: `cid${i}`,
        tokenURI: `ipfs://uri${i}`,
      }));

      await expect(
        nft.connect(issuer).batchMint(user.address, "PROJECT_MAX_BATCH", credits)
      ).to.not.be.reverted;

      const stats = await nft.getGlobalStats();
      expect(stats.active).to.equal(maxBatchSize);
    });

    it("Should reject over-sized batches", async function () {
      const { nft, issuer, user } = await loadFixture(deployNFTFixture);

      const oversizedBatch = 101; // Over limit
      const credits = Array(oversizedBatch).fill(0).map((_, i) => ({
        projectName: `Batch Credit ${i}`,
        serialNumber: `BATCH-OVER-${i}`,
        methodology: "VERRA_VCS",
        co2Tonnes: ethers.parseUnits("100", 18),
        vintageYear: 2024,
        geography: "IN",
        oracleProofHash: ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
        satelliteDataCID: `cid${i}`,
        tokenURI: `ipfs://uri${i}`,
      }));

      await expect(
        nft.connect(issuer).batchMint(user.address, "PROJECT_OVERSIZED", credits)
      ).to.be.revertedWith("Invalid batch size");
    });
  });

  // ============ REENTRANCY ATTACK TESTS ============
  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy on retirement", async function () {
      const { nft, issuer } = await loadFixture(deployNFTFixture);

      // Deploy malicious contract
      const MaliciousRetirer = await ethers.getContractFactory("MaliciousRetirer");
      const attacker = await MaliciousRetirer.deploy(await nft.getAddress());
      await attacker.waitForDeployment();

      // Mint credit to attacker
      await nft.connect(issuer).mintCredit(
        await attacker.getAddress(),
        "PROJECT_ATTACK",
        "Test",
        "ATTACK-001",
        "VERRA_VCS",
        ethers.parseUnits("1000", 18),
        2024,
        "IN",
        ethers.keccak256(ethers.toUtf8Bytes("proof")),
        "cid",
        "ipfs://uri"
      );

      // Attempt reentrancy attack
      await expect(attacker.attack(1, "Reentrancy attempt")).to.be.reverted;
    });
  });

  // ============ GAS LIMIT TESTS ============
  describe("Gas Limit Tests", function () {
    it("Should handle large batch mints within gas limits", async function () {
      this.timeout(120000); // 2 minutes

      const { nft, issuer, user } = await loadFixture(deployNFTFixture);

      const batchSizes = [10, 25, 50, 75, 100];

      for (const size of batchSizes) {
        const credits = Array(size).fill(0).map((_, i) => ({
          projectName: `Gas Test ${i}`,
          serialNumber: `GAS-${size}-${i}`,
          methodology: "VERRA_VCS",
          co2Tonnes: ethers.parseUnits("100", 18),
          vintageYear: 2024,
          geography: "IN",
          oracleProofHash: ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
          satelliteDataCID: `cid${i}`,
          tokenURI: `ipfs://uri${i}`,
        }));

        const tx = await nft.connect(issuer).batchMint(
          user.address,
          `PROJECT_GAS_${size}`,
          credits
        );
        const receipt = await tx.wait();

        console.log(`      Batch size ${size}: ${receipt.gasUsed} gas`);
        expect(receipt.gasUsed).to.be.lessThan(8000000); // Block gas limit
      }
    });
  });

  // ============ EDGE CASE TESTS ============
  describe("Edge Cases", function () {
    it("Should handle zero address checks", async function () {
      const { nft, issuer } = await loadFixture(deployNFTFixture);

      await expect(
        nft.connect(issuer).mintCredit(
          ethers.ZeroAddress,
          "PROJECT_001",
          "Test",
          "ZERO-001",
          "VERRA_VCS",
          ethers.parseUnits("1000", 18),
          2024,
          "IN",
          ethers.keccak256(ethers.toUtf8Bytes("proof")),
          "cid",
          "ipfs://uri"
        )
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should handle max uint256 values", async function () {
      const { nft, issuer, user } = await loadFixture(deployNFTFixture);

      const maxUint = ethers.MaxUint256;

      // Should handle extremely large co2Tonnes
      await expect(
        nft.connect(issuer).mintCredit(
          user.address,
          "PROJECT_MAX",
          "Test",
          "MAX-001",
          "VERRA_VCS",
          maxUint,
          2024,
          "IN",
          ethers.keccak256(ethers.toUtf8Bytes("proof")),
          "cid",
          "ipfs://uri"
        )
      ).to.not.be.reverted;
    });

    it("Should handle sequential rapid minting", async function () {
      this.timeout(60000);

      const { nft, issuer, user } = await loadFixture(deployNFTFixture);

      const rapidMints = 50;
      const promises = [];

      for (let i = 0; i < rapidMints; i++) {
        const promise = nft.connect(issuer).mintCredit(
          user.address,
          `PROJECT_RAPID_${i}`,
          "Rapid Test",
          `RAPID-${i}`,
          "VERRA_VCS",
          ethers.parseUnits("100", 18),
          2024,
          "IN",
          ethers.keccak256(ethers.toUtf8Bytes(`proof${i}`)),
          `cid${i}`,
          `ipfs://uri${i}`
        );
        promises.push(promise);
      }

      await Promise.all(promises);

      const stats = await nft.getGlobalStats();
      expect(stats.active).to.equal(rapidMints);
    });
  });
});
