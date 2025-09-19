import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterUUPSV2Module", (m) => {
  const counterUUPSV2 = m.contract("CounterUUPSV2", []);
  
  return { counterUUPSV2 };
});
