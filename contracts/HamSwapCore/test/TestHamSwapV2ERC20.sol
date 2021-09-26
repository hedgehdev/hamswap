pragma solidity >=0.6.12;

import '../HamSwapV2ERC20.sol';

contract TestHamSwapV2ERC20 is HamSwapV2ERC20 {
    constructor(uint _totalSupply) public {
        _mint(msg.sender, _totalSupply);
    }
}
