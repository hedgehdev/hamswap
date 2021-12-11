import chai, { expect } from 'chai'
import { Contract, Wallet, providers, BigNumber, constants } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, DELAY } from './utilities'

import TestHamSwapV2ERC20 from '../../build/TestHamSwapV2ERC20.json'
import HamSwapV2Factory from '../../build/HamSwapV2Factory.json'
import HamSwapV2Pair from '../../build/HamSwapV2Pair.json'
import IHamSwapV2Pair from '../../build/IHamSwapV2Pair.json'
import HamSwapV2Router02 from '../../build/HamSwapV2Router02.json'
import RouterEventEmitter from '../../build/RouterEventEmitter.json'
import WETH9 from '../../build/WETH9.json'

import Hoglet from '../../build/Hoglet.json'
import Timelock from '../../build/Timelock.json'
import GovernorAlpha from '../../build/GovernorAlpha.json'
import HogBar from '../../build/HogBar.json'


interface FactoryFixture {
  factory: Contract
}

const overrides = {
  gasLimit: 9999999
}

export async function factoryFixture([wallet]: Wallet[], provider: providers.Web3Provider): Promise<FactoryFixture> {
  const factory = await deployContract(wallet, HamSwapV2Factory, [wallet.address], overrides)
  return { factory }
}

interface PairFixture extends FactoryFixture {
  token0: Contract
  token1: Contract
  pair: Contract
}

export async function pairFixture([wallet]: Wallet[], provider: providers.Web3Provider): Promise<PairFixture> {
  const { factory } = await factoryFixture([wallet], provider)

  const tokenA = await deployContract(wallet, TestHamSwapV2ERC20, [expandTo18Decimals(10000)], overrides)
  const tokenB = await deployContract(wallet, TestHamSwapV2ERC20, [expandTo18Decimals(10000)], overrides)

  const virt = "0"

  await factory.createPair(tokenA.address, tokenB.address, virt, overrides)
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address, virt)
  const pair = new Contract(pairAddress, JSON.stringify(HamSwapV2Pair.abi), provider).connect(wallet)

  const token0Address = (await pair.token0()).address
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  return { factory, token0, token1, pair }
}


interface HamPairFixture extends PairFixture {
  virt : BigNumber
}


export async function pairFixture_rEqualsPoint1([wallet]: Wallet[], provider: providers.Web3Provider): Promise<HamPairFixture> {
  const { factory } = await factoryFixture([wallet], provider)

  const tokenA = await deployContract(wallet, TestHamSwapV2ERC20, [expandTo18Decimals(10000)], overrides)
  const tokenB = await deployContract(wallet, TestHamSwapV2ERC20, [expandTo18Decimals(10000)], overrides)

  const virtStr = "1000" // 0.1

  await factory.createPair(tokenA.address, tokenB.address, virtStr, overrides)
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address, virtStr)
  const pair = new Contract(pairAddress, JSON.stringify(HamSwapV2Pair.abi), provider).connect(wallet)

  const token0Address = (await pair.token0()).address
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  const virt = BigNumber.from(virtStr)
  return { factory, token0, token1, pair, virt}
}



interface V2Fixture {
  token0: Contract
  token1: Contract
  WETH: Contract
  WETHPartner: Contract
  factoryV2: Contract
  router02: Contract
  routerEventEmitter: Contract
  router: Contract
  pair: Contract
  WETHPair: Contract
  virt: BigNumber
}

export async function v2Fixture([wallet]: Wallet[],provider: providers.Web3Provider): Promise<V2Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, TestHamSwapV2ERC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, TestHamSwapV2ERC20, [expandTo18Decimals(10000)])
  const WETH = await deployContract(wallet, WETH9)
  const WETHPartner = await deployContract(wallet, TestHamSwapV2ERC20, [expandTo18Decimals(10000)])


  // deploy V2
  const factoryV2 = await deployContract(wallet, HamSwapV2Factory, [wallet.address])

  // deploy routers
  const router02 = await deployContract(wallet, HamSwapV2Router02, [factoryV2.address, WETH.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // initialize V2
  let virtStr = "1000"
  await factoryV2.createPair(tokenA.address, tokenB.address, virtStr)
  const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address, virtStr)
  const pair = new Contract(pairAddress, JSON.stringify(IHamSwapV2Pair.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await factoryV2.createPair(WETH.address, WETHPartner.address, virtStr)
  const WETHPairAddress = await factoryV2.getPair(WETH.address, WETHPartner.address, virtStr)
  const WETHPair = new Contract(WETHPairAddress, JSON.stringify(IHamSwapV2Pair.abi), provider).connect(wallet)

  const virt = BigNumber.from(virtStr)
  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    factoryV2,
    router02,
    router: router02, // the default router, 01 had a minor bug
    routerEventEmitter,
    pair,
    WETHPair,
    virt
  }
}


chai.use(solidity)


interface GovernanceFixture {
  hog: Contract
  timelock: Contract
  governorAlpha: Contract
  hogBar: Contract
}

export async function governanceFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<GovernanceFixture> {
  
  
  
  // const { timestamp: now } = await provider.getBlock('latest')
  // const timelockAddress = Contract.getContractAddress({ from: wallet.address, nonce: 1 })
  
  const hog = await deployContract(wallet, Hoglet, []);

  const timelock = await deployContract(wallet, Timelock, [wallet.address, DELAY])

  const governorAlpha = await deployContract(wallet, GovernorAlpha, [timelock.address, hog.address, wallet.address])

  await timelock.setPendingAdmin(governorAlpha.address)
  await governorAlpha.__acceptAdmin();

  expect(await timelock.admin()).to.be.eq(governorAlpha.address)
  expect(await timelock.pendingAdmin()).to.be.eq(constants.AddressZero)
  expect(await governorAlpha.hog()).to.be.eq(hog.address)
  expect(await governorAlpha.timelock()).to.be.eq(timelock.address)
  expect(await governorAlpha.guardian()).to.be.eq(wallet.address)

  const hogBar = await deployContract(wallet, HogBar, [hog.address])

  return { hog, timelock, governorAlpha, hogBar }
}
