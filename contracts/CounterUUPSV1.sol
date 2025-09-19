// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract CounterUUPSV1 is Initializable, Ownable2StepUpgradeable, UUPSUpgradeable {
    uint256 public count;
    string public version;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    function initialize(
        address initialOwner
    ) public initializer {
        __Ownable_init(initialOwner);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        count = 0;
        version = "V1";
    }

    event CountIncremented(uint256 newCount);
    event CountDecremented(uint256 newCount);
    event CountReset();

    function initialize() public initializer onlyOwner {
        count = 0;
        version = "V1";
    }

    function increment() public {
        count++;
        emit CountIncremented(count);
    }

    function decrement() public {
        require(count > 0, "Count cannot be negative");
        count--;
        emit CountDecremented(count);
    }

    function reset() public {
        count = 0;
        emit CountReset();
    }

    function getCount() public view returns (uint256) {
        return count;
    }
    // UUPS 업그레이드 특징: 업그레이드 권한에 대한 정의가 로직단에 존재
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function getVersion() public view returns (string memory) {
        return version;
    }

}
