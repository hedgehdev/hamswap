import { Contract, Wallet, providers } from 'ethers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import TestHamSwapV2ERC20 from '../../build/TestHamSwapV2ERC20.json'
import HamSwapV2Factory from '../../build/HamSwapV2Factory.json'
import HamSwapV2Pair from '../../build/HamSwapV2Pair.json'

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
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(HamSwapV2Pair.abi), provider).connect(wallet)

  const token0Address = (await pair.token0()).address
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  return { factory, token0, token1, pair }
}
