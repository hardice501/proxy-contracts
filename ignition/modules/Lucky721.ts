import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Lucky721Module", (m) => {
  const deployer = m.getAccount(0);
  const lucky721 = m.contract("Lucky721", [deployer]);

  m.staticCall(lucky721, "name", []);
  return { lucky721 };
});
