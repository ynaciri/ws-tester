// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;

contract SampleContract {
  uint count;

  event CountIncreased(uint newValue);
  event CountDecreased(uint newValue);

  function inc() public {
    count = count + 1;
    emit CountIncreased(count);
  }

  function dec() public {
    count = count - 1;
    emit CountDecreased(count);
  }

  function add(uint value) public {
    for (uint i=0 ; i < value ; i++) {
      inc();
    }
  }

  function sub(uint value) public {
    for (uint i=0 ; i < value ; i++) {
      dec();
    }
  }
}
