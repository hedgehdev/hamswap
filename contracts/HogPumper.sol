pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./HamSwapCore/interfaces/IHamSwapV2Factory.sol";
import "./HamSwapCore/interfaces/IHamSwapV2Pair.sol";

// COPIED FROM: https://github.com/sushiswap/sushiswap/blob/master/contracts/SushiMaker.sol
// Modified by hogletdev
// HogPumper generates rewards for xHOG holders by trading tokens collected from fees for HOG

contract HogPumper {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IHamSwapV2Factory public factory;
    address public bar;
    address public hog;
    address public weth;

    constructor(IHamSwapV2Factory _factory, address _bar, address _hog, address _weth) public {
        factory = _factory;
        hog = _hog;
        bar = _bar;
        weth = _weth;
    }

    function convert(address token0, address token1, uint[] calldata token01Virts,
        uint[3] calldata virts /* [token02WethVirt, token12WethVirt, weth2HogVirt] */
    ) public {
        // At least we try to make front-running harder to do.
        require(msg.sender == tx.origin, "do not convert from contract");
        uint amount0;
        uint amount1;
        for (uint i; i < virts.length; i++) {
            IHamSwapV2Pair pair = IHamSwapV2Pair(factory.getPair(token0, token1, token01Virts[i]));
            pair.transfer(address(pair), pair.balanceOf(address(this)));
            (uint amount0i, uint amount1i) = pair.burn(address(this));
            amount0 = amount0.add(amount0i);
            amount1 = amount1.add(amount1i);
        }

        // First we convert everything to WETH
        uint256 wethAmount = _toWETH(token0, amount0, virts[0], virts[2]) + _toWETH(token1, amount1, virts[1], virts[2]);
        // Then we convert the WETH to Hog
        _toHOG(wethAmount, virts[2]);
    }

    // Converts token passed as an argument to WETH
    function _toWETH(address token, uint amountIn, uint token2WethVirt, uint wethHogVirt) internal returns (uint256) {
        // If the passed token is Hog, don't convert anything
        if (token == hog) {
            _safeTransfer(token, bar, amountIn);
            return 0;
        }
        // If the passed token is WETH, don't convert anything
        if (token == weth) {
            _safeTransfer(token, factory.getPair(weth, hog, token2WethVirt), amountIn);
            return amountIn;
        }
        // If the target pair doesn't exist, don't convert anything
        IHamSwapV2Pair pair = IHamSwapV2Pair(factory.getPair(token, weth, token2WethVirt));
        if (address(pair) == address(0)) {
            return 0;
        }
        // Choose the correct reserve to swap from
        uint amountOut;
        uint amount0Out;
        uint amount1Out;
        {
            (uint reserve0, uint reserve1,) = pair.getReserves();
            address token0 = pair.token0();
            (uint reserveIn, uint reserveOut) = token0 == token ? (reserve0, reserve1) : (reserve1, reserve0);
            // Calculate information required to swap
            uint amountInWithFee = amountIn.mul(997);
            amountOut = amountInWithFee.mul(reserveOut) / reserveIn.mul(1000).add(amountInWithFee);
            (amount0Out, amount1Out) = token0 == token ? (uint(0), amountOut) : (amountOut, uint(0));
        }
        _safeTransfer(token, address(pair), amountIn);
        pair.swap(amount0Out, amount1Out, factory.getPair(weth, hog, wethHogVirt), new bytes(0));
        return amountOut;
    }

    // Converts WETH to Hog
    function _toHOG(uint256 amountIn, uint weth2Hogvirt) internal {
        IHamSwapV2Pair pair = IHamSwapV2Pair(factory.getPair(weth, hog, weth2Hogvirt));
        // Choose WETH as input token
        (uint reserve0, uint reserve1,) = pair.getReserves();
        address token0 = pair.token0();
        (uint reserveIn, uint reserveOut) = token0 == weth ? (reserve0, reserve1) : (reserve1, reserve0);
        // Calculate information required to swap
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        uint amountOut = numerator / denominator;
        (uint amount0Out, uint amount1Out) = token0 == weth ? (uint(0), amountOut) : (amountOut, uint(0));
        // Swap WETH for Hog
        pair.swap(amount0Out, amount1Out, bar, new bytes(0));
    }

    // Wrapper for safeTransfer
    function _safeTransfer(address token, address to, uint256 amount) internal {
        IERC20(token).safeTransfer(to, amount);
    }
}