import { network } from "hardhat";
import CounterUUPSV1Module from "../ignition/modules/CounterUUPSV1";
import { CounterUUPSV1__factory } from "../types/ethers-contracts/factories/CounterUUPSV1__factory";
import { CounterUUPSV2__factory } from "../types/ethers-contracts/factories/CounterUUPSV2__factory";
import CounterUUPSV2Module from "../ignition/modules/CounterUUPSV2";
import fs from "fs";
import path from "path";
const { ethers, ignition } = await network.connect();

async function main() {
  console.log("🔄 UUPS 업그레이드 스크립트 시작...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  try {
    // 1. V1 구현체 배포
    console.log("\n📝 CounterUUPSV1 배포 중...");
    const { counterUUPSV1 } = await ignition.deploy(CounterUUPSV1Module);
    console.log(`✅ CounterUUPSV1: ${await counterUUPSV1.getAddress()}`);

    // 2. V2 구현체 배포
    console.log("\n📝 CounterUUPSV2 배포 중...");
    const { counterUUPSV2 } = await ignition.deploy(CounterUUPSV2Module);
    console.log(`✅ CounterUUPSV2: ${await counterUUPSV2.getAddress()}`);

    // 3. UUPS 프록시 배포
    console.log("\n🔄 UUPS 프록시 배포 중...");
    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const uupsProxy = await ERC1967Proxy.deploy(
      await counterUUPSV1.getAddress(),
      counterUUPSV1.interface.encodeFunctionData("initialize(address)", [deployer.address])
    );
    await uupsProxy.waitForDeployment();

    const uupsCounter = CounterUUPSV1__factory.connect(await uupsProxy.getAddress(), deployer);
    console.log(`✅ UUPS 프록시: ${await uupsProxy.getAddress()}`);

    // 4. V1 기능 테스트
    console.log("\n🧪 V1 기능 테스트:");
    console.log("초기 Count:", await uupsCounter.getCount());
    console.log("초기 Version:", await uupsCounter.getVersion());

    await uupsCounter.increment();
    await uupsCounter.increment();
    console.log("2번 증가 후 Count:", await uupsCounter.getCount());

    await uupsCounter.decrement();
    console.log("1번 감소 후 Count:", await uupsCounter.getCount());

    // 5. UUPS 업그레이드
    console.log("\n🚀 UUPS 업그레이드 실행:");
    console.log("업그레이드 전 Version:", await uupsCounter.getVersion());
    console.log("업그레이드 전 Count:", await uupsCounter.getCount());

    try {
      const upgradeTx = await uupsCounter.upgradeToAndCall(
        await counterUUPSV2.getAddress(),
        counterUUPSV2.interface.encodeFunctionData("reinitialize")
      );
      await upgradeTx.wait();

      console.log("✅ 업그레이드 트랜잭션 완료!");

      // 6. V2 기능 테스트
      console.log("\n🧪 V2 기능 테스트:");
      const uupsCounterV2 = CounterUUPSV2__factory.connect(await uupsProxy.getAddress(), deployer);

      console.log("업그레이드 후 Version:", await uupsCounterV2.getVersion());
      console.log("업그레이드 후 Count:", await uupsCounterV2.getCount());
      console.log("업그레이드 후 Multiplier:", await uupsCounterV2.getMultiplier());

      // V2의 새로운 기능 테스트
      await uupsCounterV2.multiply();
      console.log("곱셈 후 Count:", await uupsCounterV2.getCount());

      await uupsCounterV2.incrementUserCount();
      console.log("User Count:", await uupsCounterV2.getUserCount(deployer.address));
    } catch (upgradeError) {
      console.log("❌ 업그레이드 실패:", upgradeError);
      console.log("V1 상태로 계속 진행합니다.");
    }

    // 7. 배포 정보 저장
    const deploymentInfo = {
      type: "UUPS",
      implementations: {
        v1: await counterUUPSV1.getAddress(),
        v2: await counterUUPSV2.getAddress(),
      },
      proxy: await uupsProxy.getAddress(),
      network: await ethers.provider.getNetwork(),
      timestamp: new Date().toISOString(),
    };
    
    const deploymentPath = path.resolve(process.cwd(), "deployments", "uups-upgrade.json");
    const dir = path.dirname(deploymentPath);
    
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2), "utf-8");
    
    console.log("\n📊 UUPS 업그레이드 결과:");
    console.log(`V1 구현체: ${await counterUUPSV1.getAddress()}`);
    console.log(`V2 구현체: ${await counterUUPSV2.getAddress()}`);
    console.log(`프록시 주소: ${await uupsProxy.getAddress()}`);
    console.log(`최종 Count: ${await counterUUPSV2.getCount()}`);
    console.log(`최종 Version: ${await counterUUPSV2.getVersion()}`);
    console.log(`배포 정보 저장: ${deploymentPath}`);
    
    console.log("\n🎉 UUPS 업그레이드 완료!");

    } catch (error) {
        console.error("❌ UUPS 업그레이드 실패:", error);
    }
}

main().catch((error) => {
    console.error("메인 함수 실행 중 오류 발생:", error);
});
