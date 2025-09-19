import { network, } from "hardhat";
import CounterTransparentV1Module from "../ignition/modules/CounterTransparentV1";
import CounterTransparentV2Module from "../ignition/modules/CounterTransparentV2";
import { CounterTransparentV1__factory } from "../types/ethers-contracts/factories/CounterTransparentV1__factory";
import { CounterTransparentV2__factory } from "../types/ethers-contracts/factories/CounterTransparentV2__factory";
import fs from "fs";
import path from "path";
const { ethers, ignition } = await network.connect();

function toSlot(label: string): string {
    // slot = keccak256(utf8(label)) - 1
    const h = BigInt(ethers.keccak256(ethers.toUtf8Bytes(label)));
    const slot = "0x" + (h - 1n).toString(16).padStart(64, "0");
    return slot;
  }

function toAddressFrom32Bytes(word: string): string {
// 32바이트 중 마지막 20바이트가 주소
// word 예: 0x000000...<40hex>
    return ethers.getAddress("0x" + word.slice(26)); // 0x + 24(0x + 24 hex) 이후 40 hex
}
const implSlot = toSlot("eip1967.proxy.implementation");
const adminSlot = toSlot("eip1967.proxy.admin");

async function main() {
  console.log("🔍 Transparent 업그레이드 스크립트 시작...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  try {
    // 1. V1 구현체 배포
    console.log("\n📝 CounterTransparentV1 배포 중...");
    const { counterTransparentV1 } = await ignition.deploy(CounterTransparentV1Module);
    console.log(`✅ CounterTransparentV1: ${await counterTransparentV1.getAddress()}`);
    
    // 2. V2 구현체 배포
    console.log("\n📝 CounterTransparentV2 배포 중...");
    const { counterTransparentV2 } = await ignition.deploy(CounterTransparentV2Module);
    console.log(`✅ CounterTransparentV2: ${await counterTransparentV2.getAddress()}`);
    
    // 3. ProxyAdmin 배포
    console.log("\n🔍 ProxyAdmin 배포 중...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
    await proxyAdmin.waitForDeployment();
    console.log(`✅ ProxyAdmin: ${await proxyAdmin.getAddress()}`);
    
    // 4. Transparent 프록시 배포
    console.log("\n🔍 Transparent 프록시 배포 중...");
    const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const transparentProxy = await TransparentUpgradeableProxy.deploy(
      await counterTransparentV1.getAddress(),
      await proxyAdmin.getAddress(),
      counterTransparentV1.interface.encodeFunctionData("initialize")
    );
    await transparentProxy.waitForDeployment();
    
    const transparentCounter = CounterTransparentV1__factory.connect(await transparentProxy.getAddress(), deployer);
    
    console.log(`✅ Transparent 프록시: ${await transparentProxy.getAddress()}`);
    
    // 5. V1 기능 테스트
    console.log("\n🧪 V1 기능 테스트:");
    console.log("초기 Count:", await transparentCounter.getCount());
    console.log("초기 Version:", await transparentCounter.getVersion());
    
    await transparentCounter.increment();
    await transparentCounter.increment();
    await transparentCounter.increment();
    
    console.log("3번 증가 후 Count:", await transparentCounter.getCount());
    
    // 6. Transparent 업그레이드 (ProxyAdmin을 통해)
    console.log("\n🚀 Transparent 업그레이드 실행:");
    console.log("업그레이드 전 Version:", await transparentCounter.getVersion());
    console.log("업그레이드 전 Count:", await transparentCounter.getCount());
    
    const upgradeTx = await proxyAdmin.upgradeAndCall(
      await transparentProxy.getAddress(),
      await counterTransparentV2.getAddress(),
      counterTransparentV2.interface.encodeFunctionData("reinitialize")
    );
    await upgradeTx.wait();
    
    console.log("✅ Transparent 업그레이드 트랜잭션 완료!");
    
    // 7. V2 기능 테스트
    console.log("\n🧪 V2 기능 테스트:");
    const transparentCounterV2 = CounterTransparentV2__factory.connect(await transparentProxy.getAddress(), deployer);
    
    console.log("업그레이드 후 Version:", await transparentCounterV2.getVersion());
    console.log("업그레이드 후 Count:", await transparentCounterV2.getCount());
    console.log("업그레이드 후 Multiplier:", await transparentCounterV2.getMultiplier());
    
    // V2의 새로운 기능 테스트
    await transparentCounterV2.multiply();
    console.log("곱셈 후 Count:", await transparentCounterV2.getCount());
    
    await transparentCounterV2.incrementUserCount();
    console.log("User Count:", await transparentCounterV2.getUserCount(deployer.address));
    
    // 8. ProxyAdmin 기능 확인
    console.log("\n🔍 ProxyAdmin 기능 확인:");
    try {
      const implWord = await ethers.provider.getStorage(await transparentProxy.getAddress(), implSlot);
      const adminWord = await ethers.provider.getStorage(await transparentProxy.getAddress(), adminSlot);

      const implementation = toAddressFrom32Bytes(implWord);
      const admin = toAddressFrom32Bytes(adminWord);
      console.log("현재 구현체 주소:", implementation);
      console.log("V2 구현체 주소:", await counterTransparentV2.getAddress());
      console.log("구현체 일치 여부:", implementation.toLowerCase() === (await counterTransparentV2.getAddress()).toLowerCase());
    } catch (error) {
      console.log("❌ ProxyAdmin 기능 확인 실패:");
    }
    
    // 9. 배포 정보 저장
    const deploymentInfo = {
      type: "Transparent",
      implementations: {
        v1: await counterTransparentV1.getAddress(),
        v2: await counterTransparentV2.getAddress(),
      },
      proxy: await transparentProxy.getAddress(),
      proxyAdmin: await proxyAdmin.getAddress(),
      network: await ethers.provider.getNetwork(),
      timestamp: new Date().toISOString(),
    };
    

    const deploymentPath = path.resolve(process.cwd(), "deployments", "transparent-upgrade.json");
    const dir = path.dirname(deploymentPath);
    
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2), "utf-8");
    
    console.log("\n📊 Transparent 업그레이드 결과:");
    console.log(`V1 구현체: ${await counterTransparentV1.getAddress()}`);
    console.log(`V2 구현체: ${await counterTransparentV2.getAddress()}`);
    console.log(`프록시 주소: ${await transparentProxy.getAddress()}`);
    console.log(`ProxyAdmin 주소: ${await proxyAdmin.getAddress()}`);
    console.log(`최종 Count: ${await transparentCounterV2.getCount()}`);
    console.log(`최종 Version: ${await transparentCounterV2.getVersion()}`);
    console.log(`배포 정보 저장: ${deploymentPath}`);
    
    console.log("\n🎉 Transparent 업그레이드 완료!");
    console.log("💡 Transparent의 특징: ProxyAdmin을 통해 업그레이드하며, 관리자와 사용자 역할이 분리됩니다!");
    
  } catch (error) {
    console.error("❌ Transparent 업그레이드 실패:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 스크립트 실행 실패:", error);
    process.exit(1);
  });
