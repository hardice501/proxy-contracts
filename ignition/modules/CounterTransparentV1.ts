import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterTransparentV1Module", (m) => {
  const counterTransparentV1 = m.contract("CounterTransparentV1", []);
  
  return { counterTransparentV1 };
});
