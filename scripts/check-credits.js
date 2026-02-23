const hre = require("hardhat");

async function main() {
  console.log("\n🔍 Checking Carbon Credits...\n");

  // Get the contract addresses
  const NFT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  // Get first test account (the one you should be using)
  const [account0] = await hre.ethers.getSigners();
  
  console.log("Account Address:", account0.address);
  console.log("Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\n");

  // Get the NFT contract
  const CarbonCreditNFT = await hre.ethers.getContractAt("CarbonCreditNFT", NFT_ADDRESS);

  // Check if user has registered
  const hasRegistered = await CarbonCreditNFT.hasRegistered(account0.address);
  console.log("Has Registered:", hasRegistered);

  // Get NFT balance
  const balance = await CarbonCreditNFT.balanceOf(account0.address);
  console.log("NFT Balance:", balance.toString());

  // Get token IDs owned
  if (balance > 0) {
    console.log("\n📋 Your Carbon Credits (NFTs):");
    for (let i = 0; i < balance; i++) {
      const tokenId = await CarbonCreditNFT.tokenOfOwnerByIndex(account0.address, i);
      const credit = await CarbonCreditNFT.credits(tokenId);
      console.log(`\n  Token ID: ${tokenId}`);
      console.log(`  Project: ${credit.projectName}`);
      console.log(`  CO2 Tonnes: ${hre.ethers.formatEther(credit.co2Tonnes)}`);
      console.log(`  Methodology: ${credit.methodology}`);
      console.log(`  Retired: ${credit.isRetired}`);
    }
  } else {
    console.log("\n❌ No credits found!");
    
    if (!hasRegistered) {
      console.log("\n💡 To claim your 5 free credits:");
      console.log("   1. Make sure your Hardhat node is running");
      console.log("   2. Import the account above into MetaMask");
      console.log("   3. Register your company at http://localhost:3000/company/register");
      console.log("   4. The transaction will automatically mint 5 credits to your wallet\n");
    }
  }

  // Get global stats
  console.log("\n📊 Global Statistics:");
  const totalMinted = await CarbonCreditNFT.totalMintedTonnes();
  const totalRetired = await CarbonCreditNFT.totalRetiredTonnes();
  const totalActive = await CarbonCreditNFT.totalActiveCredits();
  console.log(`  Total Minted: ${hre.ethers.formatEther(totalMinted)} tonnes`);
  console.log(`  Total Retired: ${hre.ethers.formatEther(totalRetired)} tonnes`);
  console.log(`  Total Active Credits: ${totalActive.toString()}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
