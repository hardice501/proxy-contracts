// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "hardhat/console.sol";

contract CounterBeaconV2 is Initializable, Ownable2StepUpgradeable {
    uint256 public count;
    string public version;
    uint256 public multiplier;
    mapping(address => uint256) public userCounts;

    event CountIncremented(uint256 newCount);
    event CountDecremented(uint256 newCount);
    event CountReset();
    event CountMultiplied(uint256 newCount);
    event UserCountUpdated(address indexed user, uint256 newCount);

    function initialize() public initializer {
        __Ownable2Step_init();
        count = 0;
        version = "Beacon-V2";
        multiplier = 2;
    }

    function reinitialize() public reinitializer(2) {
        version = "Beacon-V2";
        multiplier = 2;
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

    function multiply() public {
        count = count * multiplier;
        emit CountMultiplied(count);
    }

    function setMultiplier(uint256 _multiplier) public {
        multiplier = _multiplier;
    }

    function incrementUserCount() public {
        userCounts[msg.sender]++;
        emit UserCountUpdated(msg.sender, userCounts[msg.sender]);
    }

    function getUserCount(address user) public view returns (uint256) {
        return userCounts[user];
    }

    function getCount() public view returns (uint256) {
        return count;
    }

    function getVersion() public view returns (string memory) {
        return version;
    }

    function getMultiplier() public view returns (uint256) {
        return multiplier;
    }
}
