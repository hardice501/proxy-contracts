import { network } from "hardhat";
import path from "path";
import fs from "fs";
const { ethers } = await network.connect();


async function main() {
  console.log("🧪 AccessControlNFT 테스트 시작...");
  
  const [deployer, minter, burner, pauser, updater, user1, user2] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();

  const filePath = path.resolve(
    process.cwd(),
    `ignition/deployments/chain-${net.chainId}/deployed_addresses.json`
  );
  
  const deployAddress = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const nftAddress = deployAddress["AccessControlNFTModule#AccessControlNFT"];
  
  console.log("NFT 컨트랙트 주소:", nftAddress);
  
  // 컨트랙트 연결
  const AccessControlNFT = await ethers.getContractFactory("AccessControlNFT");
  const nft = AccessControlNFT.attach(nftAddress);
  // 역할 정의
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
  const UPDATER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPDATER_ROLE"));
  
  
  console.log("Deployer:", deployer.address);
  console.log("Minter:", minter.address);
  console.log("Burner:", burner.address);
  console.log("Pauser:", pauser.address);
  console.log("Updater:", updater.address);
  
  // 역할 부여
  console.log("\n🔐 역할 부여 중...");
  
  // MINTER_ROLE 부여
  await nft.grantRole(MINTER_ROLE, minter.address);
  console.log(`✅ MINTER_ROLE 부여: ${minter.address}`);
  
  // BURNER_ROLE 부여
  await nft.grantRole(BURNER_ROLE, burner.address);
   console.log(`✅ BURNER_ROLE 부여: ${burner.address}`);
   
   // PAUSER_ROLE 부여
  await nft.grantRole(PAUSER_ROLE, pauser.address);
  console.log(`✅ PAUSER_ROLE 부여: ${pauser.address}`);
  
  // UPDATER_ROLE 부여
  await nft.grantRole(UPDATER_ROLE, updater.address);
  console.log(`✅ UPDATER_ROLE 부여: ${updater.address}`);  
  try {
    // 1. 기본 정보 확인
    console.log("\n📊 기본 정보 확인:");
    const contractInfo = await nft.getContractInfo();
    console.log(`현재 공급량: ${contractInfo.currentSupply}`);
    console.log(`최대 공급량: ${contractInfo.maxSupply_}`);
    console.log(`민팅 가격: ${ethers.formatEther(contractInfo.price)} ETH`);
    console.log(`주소당 최대 민팅: ${contractInfo.maxPerAddress}`);
    console.log(`일시정지 상태: ${contractInfo.paused_}`);
    
    // 2. 일반 사용자 민팅 테스트
    console.log("\n🎨 일반 사용자 민팅 테스트:");
    const mintPrice = await nft.mintPrice();
    
    // user1이 민팅
    await nft.connect(user1).mint(user1.address, 1, { value: mintPrice });
    console.log(`✅ User1 민팅 완료 (레벨 1)`);
    
    // user2가 민팅
    await nft.connect(user2).mint(user2.address, 2, { value: mintPrice });
    console.log(`✅ User2 민팅 완료 (레벨 2)`);
    
    // 3. 관리자 민팅 테스트
    console.log("\n👑 관리자 민팅 테스트:");
    await nft.connect(minter).adminMint(user1.address, 3);
    console.log(`✅ Minter가 User1에게 레벨 3 NFT 민팅`);
    
    // 4. 배치 민팅 테스트
    console.log("\n📦 배치 민팅 테스트:");
    const recipients = [user1.address, user2.address, deployer.address];
    const levels = [4, 5, 6];
    await nft.connect(minter).batchMint(recipients, levels);
    console.log(`✅ 배치 민팅 완료 (3개)`);
    
    // 5. 토큰 정보 확인
    console.log("\n🔍 토큰 정보 확인:");
    const totalSupply = await nft.totalSupply();
    console.log(`총 공급량: ${totalSupply}`);
    
    for (let i = 0; i < Math.min(Number(totalSupply), 5); i++) {
      const owner = await nft.ownerOf(i);
      const level = await nft.getTokenLevel(i);
      const locked = await nft.isTokenLocked(i);
      console.log(`Token ${i}: Owner=${owner}, Level=${level}, Locked=${locked}`);
    }
    
    // 6. 토큰 레벨 업데이트 테스트
    console.log("\n⬆️ 토큰 레벨 업데이트 테스트:");
    await nft.connect(updater).updateTokenLevel(0, 10);
    console.log(`✅ Token 0 레벨을 10으로 업데이트`);
    
    // 7. 토큰 잠금 테스트
    console.log("\n🔒 토큰 잠금 테스트:");
    await nft.connect(updater).setTokenLock(0, true);
    console.log(`✅ Token 0 잠금`);
    
    // 8. 개별 토큰 URI 설정 테스트
    console.log("\n🖼️ 개별 토큰 URI 설정 테스트:");
    await nft.connect(updater).setTokenURI(0, "https://custom-uri.com/token/0");
    console.log(`✅ Token 0 커스텀 URI 설정`);
    
    // 9. 일시정지 테스트
    console.log("\n⏸️ 일시정지 테스트:");
    await nft.connect(pauser).pause();
    console.log(`✅ 컨트랙트 일시정지`);
    
    // 일시정지 중 민팅 시도 (실패해야 함)
    try {
      await nft.connect(user1).mint(user1.address, 7, { value: mintPrice });
      console.log("❌ 일시정지 중 민팅이 성공했습니다 (예상과 다름)");
    } catch (error) {
      console.log(`✅ 일시정지 중 민팅 실패 (예상됨): ${error}`);
    }
    
    // 일시정지 해제
    await nft.connect(pauser).unpause();
    console.log(`✅ 컨트랙트 일시정지 해제`);
    
    // 10. 토큰 소각 테스트
    console.log("\n🔥 토큰 소각 테스트:");
    const tokenToBurn = Number(totalSupply) - 1;
    await nft.connect(burner).burn(tokenToBurn);
    console.log(`✅ Token ${tokenToBurn} 소각 완료`);
    
    // 11. 잠긴 토큰 전송 시도 (실패해야 함)
    console.log("\n🚫 잠긴 토큰 전송 테스트:");
    try {
      await nft.connect(user1).transferFrom(user1.address, user2.address, 0);
      console.log("❌ 잠긴 토큰 전송이 성공했습니다 (예상과 다름)");
    } catch (error) {
      console.log(`✅ 잠긴 토큰 전송 실패 (예상됨): ${error}`);
    }
    
    // 12. 잠금 해제 후 전송
    console.log("\n🔓 잠금 해제 후 전송 테스트:");
    await nft.connect(updater).setTokenLock(0, false);
    await nft.connect(user1).transferFrom(user1.address, user2.address, 0);
    console.log(`✅ Token 0 잠금 해제 후 User2에게 전송`);
    
    // 13. 최종 상태 확인
    console.log("\n📈 최종 상태 확인:");
    const finalContractInfo = await nft.getContractInfo();
    console.log(`최종 공급량: ${finalContractInfo.currentSupply}`);
    console.log(`최종 일시정지 상태: ${finalContractInfo.paused_}`);
    
    const user1Minted = await nft.getMintedCount(user1.address);
    const user2Minted = await nft.getMintedCount(user2.address);
    console.log(`User1 민팅 수: ${user1Minted}`);
    console.log(`User2 민팅 수: ${user2Minted}`);
    
    // 14. 권한 확인
    console.log("\n🔐 권한 확인:");
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));
    const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
    const UPDATER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPDATER_ROLE"));
    
    console.log(`Minter 권한 (${minter.address}): ${await nft.hasRole(MINTER_ROLE, minter.address)}`);
    console.log(`Burner 권한 (${burner.address}): ${await nft.hasRole(BURNER_ROLE, burner.address)}`);
    console.log(`Pauser 권한 (${pauser.address}): ${await nft.hasRole(PAUSER_ROLE, pauser.address)}`);
    console.log(`Updater 권한 (${updater.address}): ${await nft.hasRole(UPDATER_ROLE, updater.address)}`);
    
    console.log("\n🎉 AccessControlNFT 테스트 완료!");
    
  } catch (error) {
    console.error("❌ 테스트 실패:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 스크립트 실행 실패:", error);
    process.exit(1);
  });
