import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Lucky721V2Module", (m) => {
  const deployer = m.getAccount(0);
  const lucky721 = m.contract("Lucky721V2", [deployer]);

  m.staticCall(lucky721, "name", []);
  return { lucky721 };
});
