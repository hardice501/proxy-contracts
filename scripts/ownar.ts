import fs from "fs";
import path from "path";
import { network } from "hardhat";
import * as dotenv from "dotenv-flow";
dotenv.config();
const { ethers } = await network.connect();

import {
  Lucky721__factory
} from "../types/ethers-contracts/factories/Lucky721__factory";

async function main() {
  console.log("start");
  const net = await ethers.provider.getNetwork();
  const [currentOwner, newOwner] = await ethers.getSigners();

  const filePath = path.resolve(
    process.cwd(),
    `ignition/deployments/chain-${net.chainId}/deployed_addresses.json`
  );
  const deployAddress = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const lucky721Address = deployAddress["Lucky721Module#Lucky721"];
  console.log(lucky721Address);
  const lucky721 = Lucky721__factory.connect(lucky721Address, currentOwner);
  console.log(lucky721Address);
  console.log("현재 Owner:", await lucky721.owner());
  console.log("새로운 Owner:", await newOwner.getAddress());

  // 1단계: transferOwnership
  console.log("transferOwnership 호출");
  const tx1 = await lucky721.transferOwnership(newOwner.address);
  await tx1.wait();

  console.log("최종 Owner:", await lucky721.owner());
}

main().catch(console.error);
