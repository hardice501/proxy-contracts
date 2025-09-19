import fs from "fs";
import path from "path";
import { network } from "hardhat";
import * as dotenv from "dotenv-flow";
dotenv.config();
const { ethers } = await network.connect();

import {
  Lucky721V2__factory
} from "../types/ethers-contracts/factories/Lucky721V2__factory";

async function main() {
  const net = await ethers.provider.getNetwork();
  const [currentOwner, newOwner] = await ethers.getSigners();
  
  const filePath = path.resolve(
    process.cwd(),
    `ignition/deployments/chain-${net.chainId}/deployed_addresses.json`
  );
  const deployAddress = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const Lucky721V2Address = deployAddress["Lucky721V2Module#Lucky721V2"];
  const Lucky721V2 = Lucky721V2__factory.connect(Lucky721V2Address, currentOwner);

  console.log("현재 Owner:", await Lucky721V2.owner());
  console.log("새로운 Owner:", await newOwner.getAddress());

  // 1단계: transferOwnership
  console.log("1단계: transferOwnership 호출");
  const tx1 = await Lucky721V2.transferOwnership(await newOwner.getAddress());
  await tx1.wait();
  console.log("Pending Owner:", await Lucky721V2.pendingOwner());

  // 2단계: acceptOwnership (새로운 owner가 호출)
  console.log("2단계: acceptOwnership 호출");
  const Lucky721V2NewOwner = Lucky721V2__factory.connect(Lucky721V2Address, newOwner);
  const tx2 = await Lucky721V2NewOwner.acceptOwnership();
  await tx2.wait();

  console.log("최종 Owner:", await Lucky721V2.owner());
}

main().catch(console.error);
