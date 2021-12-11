pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

// Copied from SushiBar: https://github.com/sushiswap/sushiswap/blob/master/contracts/SushiBar.sol
// Modified by 0xLeia

// HogBar is the coolest bar hog ecosystem. You come in with some Hog, and leave with more! The longer you stay, the more Hog you get.
//
// This contract handles swapping to and from xHog, HogSwap's staking token.
contract HogBar is ERC20("HogBar", "xHOG") {
    using SafeMath for uint256;
    IERC20 public hog;

    // Define the Hog token contract
    constructor(IERC20 _hog) public {
        hog = _hog;
    }

    // Enter the gallery. Pay some HOGs. Earn some shares.
    // Locks Hog and mints xHog
    function enter(uint256 _amount) public {
        // Gets the amount of Hog locked in the contract
        uint256 totalHog = hog.balanceOf(address(this));
        // Gets the amount of xHog in existence
        uint256 totalShares = totalSupply();
        // If no xHog exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalHog == 0) {
            _mint(msg.sender, _amount);
        } 
        // Calculate and mint the amount of xHog the Hog is worth. The ratio will change overtime, as xHog is burned/minted and Hog deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalShares).div(totalHog);
            _mint(msg.sender, what);
        }
        // Lock the Hog in the contract
        hog.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the gallery. Claim back your HOGs.
    // Unclocks the staked + gained Hog and burns xHog
    function leave(uint256 _share) public {
        // Gets the amount of xHog in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of Hog the xHog is worth
        uint256 what = _share.mul(hog.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        hog.transfer(msg.sender, what);
    }
}