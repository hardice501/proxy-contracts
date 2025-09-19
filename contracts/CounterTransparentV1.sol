// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

contract CounterTransparentV1 is Initializable, Ownable2StepUpgradeable {
    uint256 public count;
    string public version;
    
    event CountIncremented(uint256 newCount);
    event CountDecremented(uint256 newCount);
    event CountReset();
    
    function initialize() public initializer {
        __Ownable2Step_init();
        
        count = 0;
        version = "Transparent-V1";
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
    
    function getVersion() public view returns (string memory) {
        return version;
    }
}
