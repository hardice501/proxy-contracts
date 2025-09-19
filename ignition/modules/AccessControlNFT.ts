import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "ethers";

const AccessControlNFTModule = buildModule("AccessControlNFTModule", (m) => {
  const accessControlNFT = m.contract("AccessControlNFT", [
    "AccessControl NFT",           // name
    "ACNFT",                      // symbol
    "https://api.example.com/nft/", // baseURI
    10000,                        // maxSupply
    ethers.parseEther("0.1"),          // mintPrice (0.1 ETH)
    5                             // maxMintPerAddress
  ]);
  return { accessControlNFT };
});

export default AccessControlNFTModule;
