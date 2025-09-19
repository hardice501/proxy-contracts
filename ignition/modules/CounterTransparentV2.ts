import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterTransparentV2Module", (m) => {
  const counterTransparentV2 = m.contract("CounterTransparentV2", []);
  
  return { counterTransparentV2 };
});
