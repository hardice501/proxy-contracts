import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterBeaconV1Module", (m) => {
  const counterBeaconV1 = m.contract("CounterBeaconV1", []);

  return { counterBeaconV1 };
});
