// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAG is ERC20, Ownable {
    uint public constant base;

    constructor(
        address initiator,
        address[] memory nfts,
        uint[] memory ids,
        uint redeemFee
    ) public {

    }
    
    // nft->dag switch nft to dag
    function mint(address nft, uint id) public {
        // check nft.id is allowed to be deposited into this

        // pull nft.id from sender to this
        
        // mint dag token, push dag token to sender
    }

    // dag->nft switch dag to nft
    function redeem(address nft, uint id) public {
        // pull (1 + fee) amount of dag to this
        
        // push nft.id to sender, burn 1 dag token
        
        // push related fee share profit to sender
    }

    // dag->nft borrow nft with dag
    function borrow(address nft, uint id) public {
        // pull (1 + dynamic_borrow_fee) dag to this

        // push nft.id to sender
    }

    // nft->dag
    function repayBorrow(address nft, uint id) public {
        // pull nft.id from sender to this

        // push 1 dag to sender
    }

    function liquidate(address borrower, address nft, uint id) public {

    }

    // deposit lp token?, dag token?, to earn borrow fee
    function stake(uint amount) public {
        
    }
    
    function withdraw(uint amount) public {

    }


}