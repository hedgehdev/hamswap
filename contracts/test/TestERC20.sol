// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract TestERC20 is ERC20 {
    constructor(string memory _name, string memory _symbol, uint _totalSupply) ERC20(_name, _symbol) public {
        _mint(msg.sender, _totalSupply);
    }

    function mint(uint amount) external {
        _mint(msg.sender, amount);
    }
    
    function burn(uint amount) external {
        _burn(msg.sender, amount);       
    }
}
