import { network } from "hardhat";
import CounterBeaconV1Module from "../ignition/modules/CounterBeaconV1";
import CounterBeaconV2Module from "../ignition/modules/CounterBeaconV2";
import { CounterBeaconV1__factory } from "../types/ethers-contracts/factories/CounterBeaconV1__factory";
import { CounterBeaconV2__factory } from "../types/ethers-contracts/factories/CounterBeaconV2__factory";
const { ethers, ignition } = await network.connect();



async function main() {
  console.log("🔍 Beacon 업그레이드 스크립트 시작...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  try {
    // 1. V1 구현체 배포
    console.log("\n📝 CounterBeaconV1 배포 중...");
    const { counterBeaconV1 } = await ignition.deploy(CounterBeaconV1Module);
    console.log(`✅ CounterBeaconV1: ${await counterBeaconV1.getAddress()}`);
    
    // 2. V2 구현체 배포
    console.log("\n📝 CounterBeaconV2 배포 중...");
    const { counterBeaconV2 } = await ignition.deploy(CounterBeaconV2Module);
    console.log(`✅ CounterBeaconV2: ${await counterBeaconV2.getAddress()}`);
    
    // 3. Beacon 배포
    console.log("\n🔍 Beacon 배포 중...");
    const UpgradeableBeacon = await ethers.getContractFactory("UpgradeableBeacon");
    const beacon = await UpgradeableBeacon.deploy(
      await counterBeaconV1.getAddress(),
      deployer.address
    );
    await beacon.waitForDeployment();
    console.log(`✅ Beacon: ${await beacon.getAddress()}`);
    
    // 4. Beacon 프록시들 배포
    console.log("\n🔍 Beacon 프록시들 배포 중...");
    const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
    
    const beaconProxy1 = await BeaconProxy.deploy(await beacon.getAddress(), "0x");
    await beaconProxy1.waitForDeployment();
    
    const beaconProxy2 = await BeaconProxy.deploy(await beacon.getAddress(), "0x");
    await beaconProxy2.waitForDeployment();
    
    const beaconCounter1 = CounterBeaconV1__factory.connect(await beaconProxy1.getAddress(), deployer);
    const beaconCounter2 = CounterBeaconV1__factory.connect(await beaconProxy2.getAddress(), deployer);
    
    await beaconCounter1.initialize();
    await beaconCounter2.initialize();
    
    console.log(`✅ Beacon Proxy 1: ${await beaconProxy1.getAddress()}`);
    console.log(`✅ Beacon Proxy 2: ${await beaconProxy2.getAddress()}`);
    
    // 5. V1 기능 테스트
    console.log("\n🧪 V1 기능 테스트:");
    console.log("Beacon Proxy 1 - 초기 Count:", await beaconCounter1.getCount());
    console.log("Beacon Proxy 2 - 초기 Count:", await beaconCounter2.getCount());
    console.log("Beacon Proxy 1 - 초기 Version:", await beaconCounter1.getVersion());

    await beaconCounter1.increment();
    await beaconCounter1.increment();
    await beaconCounter2.increment();

    console.log("Beacon Proxy 1 - Count:", await beaconCounter1.getCount());
    console.log("Beacon Proxy 2 - Count:", await beaconCounter2.getCount());

    // 6. Beacon 업그레이드
    console.log("\n🚀 Beacon 업그레이드 실행:");
    console.log("업그레이드 전 Version:", await beaconCounter1.getVersion());

    const upgradeTx = await beacon.upgradeTo(await counterBeaconV2.getAddress());
    await upgradeTx.wait();

    console.log("✅ Beacon 업그레이드 트랜잭션 완료!");

    // 7. V2 기능 테스트 (자동으로 새로운 구현체 사용)
    console.log("\n🧪 V2 기능 테스트:");
    const beaconCounter1V2 = CounterBeaconV2__factory.connect(await beaconProxy1.getAddress(), deployer);
    const beaconCounter2V2 = CounterBeaconV2__factory.connect(await beaconProxy2.getAddress(), deployer);

    console.log("업그레이드 후 Version:", await beaconCounter1V2.getVersion());
    console.log("Beacon Proxy 1 Count:", await beaconCounter1V2.getCount());
    console.log("Beacon Proxy 2 Count:", await beaconCounter2V2.getCount());
    console.log("Beacon Proxy 1 Multiplier:", await beaconCounter1V2.getMultiplier());

    // V2의 새로운 기능 테스트
    await beaconCounter1V2.multiply();
    console.log("Beacon Proxy 1 곱셈 후 Count:", await beaconCounter1V2.getCount());

    await beaconCounter2V2.multiply();
    console.log("Beacon Proxy 2 곱셈 후 Count:", await beaconCounter2V2.getCount());

    await beaconCounter1V2.incrementUserCount();
    await beaconCounter2V2.incrementUserCount();
    console.log("Beacon Proxy 1 User Count:", await beaconCounter1V2.getUserCount(deployer.address));
    console.log("Beacon Proxy 2 User Count:", await beaconCounter2V2.getUserCount(deployer.address));

    console.log("\n📊 Beacon 업그레이드 결과:");
    console.log(`V1 구현체: ${await counterBeaconV1.getAddress()}`);
    console.log(`V2 구현체: ${await counterBeaconV2.getAddress()}`);
    console.log(`Beacon 주소: ${await beacon.getAddress()}`);
    console.log(`프록시 1: ${await beaconProxy1.getAddress()}`);
    console.log(`프록시 2: ${await beaconProxy2.getAddress()}`);
    console.log(`프록시 1 최종 Count: ${await beaconCounter1V2.getCount()}`);
    console.log(`프록시 2 최종 Count: ${await beaconCounter2V2.getCount()}`);
    console.log("\n🎉 Beacon 업그레이드 완료!");
    console.log("💡 Beacon의 특징: 모든 프록시가 자동으로 새로운 구현체를 사용합니다!");

  } catch (error) {
    console.error("❌ Beacon 업그레이드 실패:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 스크립트 실행 실패:", error);
    process.exit(1);
  });
