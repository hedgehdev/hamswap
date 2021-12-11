import chai, { expect } from 'chai'
import { Contract, utils, BigNumber, constants} from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { expandTo18Decimals, encodePrice } from '../shared/utilities'
import { pairFixture_rEqualsPoint1 } from '../shared/fixtures'
import { mineBlock } from '../utils'
import { toType, TypeOutput } from 'ethereumjs-util'

const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('HamSwapV2Pair works well with r = 0.1', () => {
  const provider = new MockProvider({
    ganacheOptions: {
        hardfork: 'istanbul',
        mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
        gasLimit: 99999999,
    },
  })
  const [wallet, other] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let factory: Contract
  let token0: Contract
  let token1: Contract
  let pair: Contract
  let virt: BigNumber
  let base: BigNumber
  beforeEach(async () => {
    const fixture = await loadFixture(pairFixture_rEqualsPoint1)
    factory = fixture.factory
    token0 = fixture.token0
    token1 = fixture.token1
    pair = fixture.pair
    virt = fixture.virt
    base = BigNumber.from(10000)
  })

  it('mint:hamm', async () => {
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)

    const expectedLiquidity = expandTo18Decimals(2).mul(virt.add(base)).div(base)

    const v0 = token0Amount.mul(virt).div(base);
    const v1 = token1Amount.mul(virt).div(base);
    const reserve0 = token0Amount.add(v0);
    const reserve1 = token1Amount.add(v1);

    await expect(pair.mint(wallet.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer' )
      .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Sync')
      .withArgs(reserve0, reserve1)
      .to.emit(pair, 'Mint')
      .withArgs(wallet.address, token0Amount, token1Amount)

    expect(await pair.totalSupply()).to.eq(expectedLiquidity)
    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount)
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount)
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(reserve0)
    expect(reserves[1]).to.eq(reserve1)
  })

  async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)
    await pair.mint(wallet.address, overrides)
  }

  let calcExpectedOutputAmount = function (v0: BigNumber, v1: BigNumber, r0: BigNumber, r1: BigNumber, input0: BigNumber) {
    let output: BigNumber
    let reserve0 = v0.add(r0)
    let reserve1 = v1.add(r1)
    output = getAmountOut(input0, reserve0, reserve1)
    return output;
  }

  let getAmountOut = function (amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber) {
    let output: BigNumber
    const amountInWithFee = amountIn.mul(BigNumber.from(997))
    const numerator = amountInWithFee.mul(reserveOut)
    const denominator = reserveIn.mul(BigNumber.from(1000)).add(amountInWithFee)
    output = numerator.div(denominator)
    return output
  }

  const swapTestCases_1000: BigNumber[][] = [
    [1, 5, 10, '1662497915624478906'],
    [1, 10, 5, '453305446940074565'],

    [2, 5, 10, '2851015155847869602'],
    [2, 10, 5, '831248957812239453'],

    [1, 10, 10, '906610893880149131'],
    [1, 100, 100, '987158034397061298'],
    [1, 1000, 1000, '996006981039903216']
  ].map(a => a.map(n => (typeof n === 'string' ? BigNumber.from(n) : expandTo18Decimals(n))))
  swapTestCases_1000.forEach((swapTestCase_1000, i) => {
    it(`getInputPrice:hamm:${i}`, async () => {

      const [swapAmount, token0Amount, token1Amount, ] = swapTestCase_1000
      await addLiquidity(token0Amount, token1Amount)
      const v0 = token0Amount.mul(virt).div(base)
      const v1 = token1Amount.mul(virt).div(base)

      const expectedOutputAmount = calcExpectedOutputAmount(
        v0, v1, token0Amount, token1Amount, swapAmount
      )

      await token0.transfer(pair.address, swapAmount)
      await expect(pair.swap(0, expectedOutputAmount.add(1), wallet.address, '0x', overrides)).to.be.revertedWith(
        'HamSwapV2: K'
      )
      await pair.swap(0, expectedOutputAmount, wallet.address, '0x', overrides)
    })
  })

  let getAmountIn = function (amountOut: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber) {
    const numerator = reserveIn.mul(amountOut).mul(BigNumber.from(1000))
    const denominator = reserveOut.sub(amountOut).mul(BigNumber.from(997))
    let output: BigNumber = numerator.div(denominator)
    return output.add(BigNumber.from(1))
  }
  const optimisticTestCases: BigNumber[][] = [
    ['997000000000000000', 5, 10, 1], // given amountIn, amountOut = floor(amountIn * .997)
    ['997000000000000000', 10, 5, 1],
    ['997000000000000000', 5, 5, 1],
    [1, 5, 5, '1003009027081243732'] // given amountOut, amountIn = ceiling(amountOut / .997)
  ].map(a => a.map(n => (typeof n === 'string' ? BigNumber.from(n) : expandTo18Decimals(n))))
  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`optimistic:hamm:${i}`, async () => {
      const [amount0Out, token0Amount, token1Amount, ] = optimisticTestCase
      await addLiquidity(token0Amount, token1Amount)
      const amount1Input = getAmountIn(
        amount0Out, token1Amount.add(token1Amount.mul(virt).div(base)), token0Amount.add(token0Amount.mul(virt).div(base))
      )
      await token1.transfer(pair.address, amount1Input)
      await expect(pair.swap(amount0Out.add(1), 0, wallet.address, '0x', overrides)).to.be.revertedWith(
        'HamSwapV2: K'
      )
      await pair.swap(amount0Out, 0, wallet.address, '0x', overrides)
    })
  })

  it('swap:token0:hamm', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    const r0 = token0Amount.add(token0Amount.mul(virt).div(base))
    const r1 = token1Amount.add(token1Amount.mul(virt).div(base))
    
    const swapAmount = expandTo18Decimals(1)
    
    const expectedOutputAmount = getAmountOut(swapAmount, r0, r1)
    await token0.transfer(pair.address, swapAmount)
    await expect(pair.swap(0, expectedOutputAmount, wallet.address, '0x', overrides))
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Sync')
      .withArgs(r0.add(swapAmount), r1.sub(expectedOutputAmount))
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
    // const res = await pair.getReserves();
    // console.log("res0: ", res[0].toString(), ", r0: ", r0.add(swapAmount).toString())
    // console.log("res1: ", res[1].toString(), ", r1: ",  r1.sub(expectedOutputAmount).toString())
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(r0.add(swapAmount))
    expect(reserves[1]).to.eq(r1.sub(expectedOutputAmount))
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.add(swapAmount))
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.sub(expectedOutputAmount))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(token0Amount).sub(swapAmount))
    expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(token1Amount).add(expectedOutputAmount))
  })

  it('swap:token1:hamm', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)
    
    const r0 = token0Amount.add(token0Amount.mul(virt).div(base))
    const r1 = token1Amount.add(token1Amount.mul(virt).div(base))

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = getAmountOut(swapAmount, r1, r0)
    await token1.transfer(pair.address, swapAmount)
    await expect(pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides))
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Sync')
      .withArgs(r0.sub(expectedOutputAmount), r1.add(swapAmount))
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, 0, swapAmount, expectedOutputAmount, 0, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(r0.sub(expectedOutputAmount))
    expect(reserves[1]).to.eq(r1.add(swapAmount))
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.sub(expectedOutputAmount))
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.add(swapAmount))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(token0Amount).add(expectedOutputAmount))
    expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(token1Amount).sub(swapAmount))
  })

  it('swap:gas:hamm', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
    await pair.sync(overrides)
    
    const r0 = token0Amount.add(token0Amount.mul(virt).div(base))
    const r1 = token1Amount.add(token1Amount.mul(virt).div(base))
    
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = getAmountOut(swapAmount, r1, r0)
    await token1.transfer(pair.address, swapAmount)
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
    const tx = await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(73462)
  })

  let sqrt = function(y: BigNumber) {
    let z: BigNumber = BigNumber.from(0)
    if (y.gt(BigNumber.from(3))) {
      z = y
      let x: BigNumber = y.div(2).add(1)
      while(x.lt(z)) {
        z = x
        x = y.div(x).add(x).div(2)
      }
    } else if (!y.eq(0)) {
      z = BigNumber.from(1)
    }
    return z;
  }
  let calcExpectedLiquidity = function (r0: BigNumber, r1: BigNumber, input0: BigNumber, input1: BigNumber, l: BigNumber) {
    let inc: BigNumber
    if (!r0.eq(constants.Zero) && !r1.eq(constants.Zero)) {
      let inc0 = input0.mul(r0).div(l)
      let inc1 = input1.mul(r1).div(l)
      inc = inc0.gt(inc1) ? inc1 : inc0
    } else if (r0.eq(constants.Zero) && !r1.eq(constants.Zero)) {
      inc = input1.mul(r1).div(l)
    } else if (!r0.eq(constants.Zero) && r1.eq(constants.Zero)) {
      inc = input0.mul(r0).div(l)
    } else {
      inc = sqrt(input0.mul(input1)).mul(virt.add(base)).div(base) // including MINIMUM_LIQUIDITY
    }
    return inc
  }
  it('burn:hamm', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    const expectedLiquidity = calcExpectedLiquidity(constants.Zero, constants.Zero, token0Amount, token1Amount, constants.Zero)

    await addLiquidity(token0Amount, token1Amount)
    
    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))

    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    const v0 = token0Amount.mul(virt).div(base)
    const left0 = /* real_left0 + virtual_left0 */ token0Amount.sub(
      token0Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity)
    ).add(
      v0.sub(v0.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity))
    )
    const v1 = token1Amount.mul(virt).div(base)
    const left1 = token1Amount.sub(
      token1Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity)
    ).add(
      v1.sub(v1.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity))
    )
    await expect(pair.burn(wallet.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(pair.address, constants.AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, token0Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity))
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, token1Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity))
      .to.emit(pair, 'Sync')
      .withArgs(left0, left1)
      .to.emit(pair, 'Burn')
      .withArgs(wallet.address, token0Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity), token1Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity), wallet.address)

    expect(await pair.balanceOf(wallet.address)).to.eq(0)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
    expect(await token0.balanceOf(pair.address)).to.eq(
      token0Amount.sub(
        token0Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity)
      )
    )
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.sub(token1Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity)))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(
      token0Amount.sub(
        token0Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity)
      )
    ))
    expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(
      token1Amount.sub(
        token1Amount.mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity)
      )
    ))
  })

  it('cumulativeLast:hamm', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)
    
    const r0 = token0Amount.add(token0Amount.mul(virt).div(base))
    const r1 = token1Amount.add(token1Amount.mul(virt).div(base))

    const blockTimestamp = (await pair.getReserves())[2]
    await mineBlock(provider, blockTimestamp + 1)
    await pair.sync(overrides)

    const initialPrice = encodePrice(r0, r1)
    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0])
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1])
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 1)

    const swapAmount = expandTo18Decimals(3)
    await token0.transfer(pair.address, swapAmount)
    await mineBlock(provider, blockTimestamp + 10)
    // swap to a new price eagerly instead of syncing
    await pair.swap(0, expandTo18Decimals(1), wallet.address, '0x', overrides) // make the price nice

    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0].mul(10))
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1].mul(10))
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 10)

    await mineBlock(provider, blockTimestamp + 20)
    await pair.sync(overrides)

    const newPrice = encodePrice(r0.add(swapAmount), r1.sub(expandTo18Decimals(1)))
    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0].mul(10).add(newPrice[0].mul(10)))
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1].mul(10).add(newPrice[1].mul(10)))
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 20)
  })

  it('feeTo:off:hamm', async () => {
    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)
    
    const expectedLiquidity = calcExpectedLiquidity(constants.Zero, constants.Zero, token0Amount, token1Amount, constants.Zero)

    const r0 = token0Amount.add(token0Amount.mul(virt).div(base))
    const r1 = token1Amount.add(token1Amount.mul(virt).div(base))
    

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = getAmountOut(swapAmount, r1, r0)
    await token1.transfer(pair.address, swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)

    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pair.burn(wallet.address, overrides)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
  })

  let calLiquidityFee = function(reserve0: BigNumber, reserve1: BigNumber, kLast: BigNumber, supply: BigNumber) {
    let output: BigNumber = BigNumber.from(0)
    const liquidityFee = BigNumber.from(1)
    const liquidityFeeBase = BigNumber.from(6) 
    let rootK = sqrt(reserve0.mul(reserve1))
    let rootKLast = sqrt(kLast)
    if (rootK.gt(rootKLast)) {
      let numerator = supply.mul(rootK.sub(rootKLast))
      let denominator = liquidityFeeBase.sub(liquidityFee).mul(rootK).add(
        liquidityFee.mul(rootKLast)
      )
      output = numerator.div(denominator)
    }
    return output
  }

  let calcPairRemaingsAfterRemove = function (r0: BigNumber, r1: BigNumber, supply: BigNumber, remove: BigNumber) {
    let remain0: BigNumber
    let remain1: BigNumber
    remain0 = r0.sub(r0.mul(remove).div(supply))
    remain1 = r1.sub(r1.mul(remove).div(supply))
    return {remain0, remain1}
  }
  it('feeTo:on:hamm', async () => {
    await factory.setFeeTo(other.address)

    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)
    const expectedLiquidity = calcExpectedLiquidity(constants.Zero, constants.Zero, token0Amount, token1Amount, constants.Zero)
    
    const r0 = token0Amount.add(token0Amount.mul(virt).div(base))
    const r1 = token1Amount.add(token1Amount.mul(virt).div(base))
    
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = getAmountOut(swapAmount, r1, r0)
    await token1.transfer(pair.address, swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)

    const feeLiquidity = calLiquidityFee(r0.sub(expectedOutputAmount), r1.add(swapAmount), r0.mul(r1), expectedLiquidity)
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pair.burn(wallet.address, overrides)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY.add(feeLiquidity))
    expect(await pair.balanceOf(other.address)).to.eq(feeLiquidity)

    // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
    // ...because the initial liquidity amounts were equal
    let res = calcPairRemaingsAfterRemove(token0Amount.sub(expectedOutputAmount), token1Amount.add(swapAmount), expectedLiquidity.add(feeLiquidity), expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    expect(await token0.balanceOf(pair.address)).to.eq(res.remain0)
    expect(await token1.balanceOf(pair.address)).to.eq(res.remain1)
  })
})
