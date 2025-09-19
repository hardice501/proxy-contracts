import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterBeaconV2Module", (m) => {
  const counterBeaconV2 = m.contract("CounterBeaconV2", []);
  
  return { counterBeaconV2 };
});
