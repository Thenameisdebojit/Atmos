const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EmissionVerifier - Unit Tests", function () {
  
  async function deployVerifierFixture() {
    const [owner, registrar, projectOwner, automationRegistry] = await ethers.getSigners();

    // Deploy NFT
    const CarbonCreditNFT = await ethers.getContractFactory("CarbonCreditNFT");
    const nft = await CarbonCreditNFT.deploy();
    await nft.waitForDeployment();

    // Deploy Mock Functions Router
    const MockFunctionsRouter = await ethers.getContractFactory("MockFunctionsRouter");
    const functionsRouter = await MockFunctionsRouter.deploy();
    await functionsRouter.waitForDeployment();

    // Deploy EmissionVerifier
    const EmissionVerifier = await ethers.getContractFactory("EmissionVerifier");
    const verifier = await EmissionVerifier.deploy(
      await functionsRouter.getAddress(),
      await nft.getAddress()
    );
    await verifier.waitForDeployment();

    // Grant roles
    const ISSUER_ROLE = await nft.ISSUER_ROLE();
    await nft.grantRole(ISSUER_ROLE, await verifier.getAddress());

    const PROJECT_REGISTRAR_ROLE = await verifier.PROJECT_REGISTRAR_ROLE();
    await verifier.grantRole(PROJECT_REGISTRAR_ROLE, registrar.address);

    const AUTOMATION_ROLE = await verifier.AUTOMATION_ROLE();
    await verifier.grantRole(AUTOMATION_ROLE, automationRegistry.address);

    return { verifier, nft, functionsRouter, owner, registrar, projectOwner, automationRegistry };
  }

  // ============ PROJECT REGISTRATION TESTS ============
  describe("Project Registration", function () {
    it("Should register a new project", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      const tx = await verifier.connect(registrar).registerProject(
        "PROJECT_SOLAR_001",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18), // 10,000 tonnes baseline
        30, // 30% reduction target
        30 * 24 * 60 * 60, // 30 days interval
        "https://iot-api.atmos.com/sensors",
        "28.6139,77.2090", // Delhi coordinates
        ethers.keccak256(ethers.toUtf8Bytes("ACVA_SIGNATURE"))
      );

      await expect(tx)
        .to.emit(verifier, "ProjectRegistered")
        .withArgs("PROJECT_SOLAR_001", projectOwner.address, ethers.parseUnits("10000", 18), 30);

      const project = await verifier.getProject("PROJECT_SOLAR_001");
      expect(project.projectId).to.equal("PROJECT_SOLAR_001");
      expect(project.owner).to.equal(projectOwner.address);
      expect(project.methodology).to.equal("VERRA_VCS");
      expect(project.isActive).to.be.true;
    });

    it("Should reject registration without PROJECT_REGISTRAR_ROLE", async function () {
      const { verifier, projectOwner } = await loadFixture(deployVerifierFixture);

      await expect(
        verifier.connect(projectOwner).registerProject(
          "PROJECT_001",
          projectOwner.address,
          "VERRA_VCS",
          ethers.parseUnits("10000", 18),
          30,
          30 * 24 * 60 * 60,
          "https://iot-api.atmos.com",
          "28.6139,77.2090",
          ethers.keccak256(ethers.toUtf8Bytes("sig"))
        )
      ).to.be.reverted;
    });

    it("Should reject invalid baseline emissions", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await expect(
        verifier.connect(registrar).registerProject(
          "PROJECT_001",
          projectOwner.address,
          "VERRA_VCS",
          0, // Invalid
          30,
          30 * 24 * 60 * 60,
          "https://iot-api.atmos.com",
          "28.6139,77.2090",
          ethers.keccak256(ethers.toUtf8Bytes("sig"))
        )
      ).to.be.revertedWith("Invalid baseline");
    });

    it("Should reject invalid target reduction", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await expect(
        verifier.connect(registrar).registerProject(
          "PROJECT_001",
          projectOwner.address,
          "VERRA_VCS",
          ethers.parseUnits("10000", 18),
          150, // >100%
          30 * 24 * 60 * 60,
          "https://iot-api.atmos.com",
          "28.6139,77.2090",
          ethers.keccak256(ethers.toUtf8Bytes("sig"))
        )
      ).to.be.revertedWith("Invalid target");
    });

    it("Should prevent duplicate project registration", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await verifier.connect(registrar).registerProject(
        "PROJECT_001",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18),
        30,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com",
        "28.6139,77.2090",
        ethers.keccak256(ethers.toUtf8Bytes("sig"))
      );

      await expect(
        verifier.connect(registrar).registerProject(
          "PROJECT_001",
          projectOwner.address,
          "VERRA_VCS",
          ethers.parseUnits("5000", 18),
          20,
          30 * 24 * 60 * 60,
          "https://iot-api.atmos.com",
          "28.6139,77.2090",
          ethers.keccak256(ethers.toUtf8Bytes("sig"))
        )
      ).to.be.revertedWith("Project already registered");
    });
  });

  // ============ CHAINLINK AUTOMATION TESTS ============
  describe("Chainlink Automation", function () {
    it("Should detect project needing verification", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await verifier.connect(registrar).registerProject(
        "PROJECT_001",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18),
        30,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com",
        "28.6139,77.2090",
        ethers.keccak256(ethers.toUtf8Bytes("sig"))
      );

      // Fast forward past verification interval
      await time.increase(31 * 24 * 60 * 60);

      const [upkeepNeeded, performData] = await verifier.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;
      
      const projectsToVerify = ethers.AbiCoder.defaultAbiCoder().decode(["string[]"], performData);
      expect(projectsToVerify[0][0]).to.equal("PROJECT_001");
    });

    it("Should not trigger upkeep before interval", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await verifier.connect(registrar).registerProject(
        "PROJECT_001",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18),
        30,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com",
        "28.6139,77.2090",
        ethers.keccak256(ethers.toUtf8Bytes("sig"))
      );

      const [upkeepNeeded] = await verifier.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });

    it("Should perform upkeep and trigger verification", async function () {
      const { verifier, registrar, projectOwner, automationRegistry } = await loadFixture(deployVerifierFixture);

      await verifier.connect(registrar).registerProject(
        "PROJECT_001",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18),
        30,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com",
        "28.6139,77.2090",
        ethers.keccak256(ethers.toUtf8Bytes("sig"))
      );

      await time.increase(31 * 24 * 60 * 60);

      const [, performData] = await verifier.checkUpkeep("0x");
      
      const tx = await verifier.connect(automationRegistry).performUpkeep(performData);
      await expect(tx).to.emit(verifier, "VerificationRequested");
    });
  });

  // ============ PROJECT DEACTIVATION TESTS ============
  describe("Project Management", function () {
    it("Should deactivate a project", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await verifier.connect(registrar).registerProject(
        "PROJECT_001",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18),
        30,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com",
        "28.6139,77.2090",
        ethers.keccak256(ethers.toUtf8Bytes("sig"))
      );

      const tx = await verifier.connect(registrar).deactivateProject("PROJECT_001", "Fraud detected");
      await expect(tx).to.emit(verifier, "ProjectDeactivated").withArgs("PROJECT_001", "Fraud detected");

      const project = await verifier.getProject("PROJECT_001");
      expect(project.isActive).to.be.false;
    });

    it("Should not include deactivated projects in upkeep", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await verifier.connect(registrar).registerProject(
        "PROJECT_001",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18),
        30,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com",
        "28.6139,77.2090",
        ethers.keccak256(ethers.toUtf8Bytes("sig"))
      );

      await verifier.connect(registrar).deactivateProject("PROJECT_001", "Completed");
      await time.increase(31 * 24 * 60 * 60);

      const [upkeepNeeded] = await verifier.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });
  });

  // ============ VIEW FUNCTION TESTS ============
  describe("View Functions", function () {
    it("Should return project details", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await verifier.connect(registrar).registerProject(
        "PROJECT_SOLAR_DELHI",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18),
        30,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com/sensors",
        "28.6139,77.2090",
        ethers.keccak256(ethers.toUtf8Bytes("ACVA_SIG"))
      );

      const project = await verifier.getProject("PROJECT_SOLAR_DELHI");
      expect(project.methodology).to.equal("VERRA_VCS");
      expect(project.iotEndpoint).to.equal("https://iot-api.atmos.com/sensors");
      expect(project.satelliteRegion).to.equal("28.6139,77.2090");
    });

    it("Should count active projects", async function () {
      const { verifier, registrar, projectOwner } = await loadFixture(deployVerifierFixture);

      await verifier.connect(registrar).registerProject(
        "PROJECT_001",
        projectOwner.address,
        "VERRA_VCS",
        ethers.parseUnits("10000", 18),
        30,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com",
        "28.6139,77.2090",
        ethers.keccak256(ethers.toUtf8Bytes("sig"))
      );

      await verifier.connect(registrar).registerProject(
        "PROJECT_002",
        projectOwner.address,
        "GOLD_STANDARD",
        ethers.parseUnits("5000", 18),
        25,
        30 * 24 * 60 * 60,
        "https://iot-api.atmos.com",
        "19.0760,72.8777",
        ethers.keccak256(ethers.toUtf8Bytes("sig2"))
      );

      const count = await verifier.getActiveProjectCount();
      expect(count).to.equal(2);
    });
  });

  // ============ CONFIGURATION TESTS ============
  describe("Chainlink Configuration", function () {
    it("Should update Functions config", async function () {
      const { verifier, owner } = await loadFixture(deployVerifierFixture);

      const donId = ethers.encodeBytes32String("fun-polygon-mumbai-1");
      const subscriptionId = 123;
      const gasLimit = 300000;

      await verifier.connect(owner).setFunctionsConfig(donId, subscriptionId, gasLimit);

      expect(await verifier.donId()).to.equal(donId);
      expect(await verifier.subscriptionId()).to.equal(subscriptionId);
      expect(await verifier.gasLimit()).to.equal(gasLimit);
    });

    it("Should update source code", async function () {
      const { verifier, owner } = await loadFixture(deployVerifierFixture);

      const newSource = "const newLogic = 'updated';";
      const tx = await verifier.connect(owner).updateSourceCode(newSource);
      
      await expect(tx).to.emit(verifier, "SourceCodeUpdated");
      expect(await verifier.emissionFetcherSource()).to.equal(newSource);
    });
  });
});
