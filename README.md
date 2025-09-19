
### Ownarable
npx hardhat ignition deploy ignition/modules/Lucky721.ts --network localhost
npx hardhat run scripts/ownar.ts --network localhost

### Ownarable2Step
npx hardhat ignition deploy ignition/modules/Lucky721V2.ts --network localhost
npx hardhat run scripts/ownar2step.ts --network localhost

### AccessControl
npx hardhat ignition deploy ignition/modules/AccessControlNFT.ts --network localhost
npx hardhat run scripts/test-access-control-nft.ts --network localhost

### UUPS Proxy
npx hardhat run scripts/upgrade-uups.ts

### Beacon Proxy
npx hardhat run scripts/upgrade-beacon.ts

### Transparent Proxy
npx hardhat run scripts/upgrade-transparent.ts
