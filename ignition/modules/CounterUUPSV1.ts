import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterUUPSV1Module", (m) => {
  const counterUUPSV1 = m.contract("CounterUUPSV1", []);
  return { counterUUPSV1 };
});
