import { providers, BigNumber, getDefaultProvider } from 'ethers'

export const DELAY = 60 * 60 * 24 * 2

export async function mineBlock(provider: providers.Web3Provider, timestamp: number): Promise<void> {
  return provider.send('evm_mine', [timestamp])
}

export async function mineBlocks(provider: providers.Web3Provider, timestamp: number, n: number): Promise<void> {
  if(n < 1){
    return provider.send('evm_mine', [timestamp]);
  }
  else{
    for(let i = 0; i < n-1; i++) {
      await provider.send('evm_mine', [timestamp])
    }
    return provider.send('evm_mine', [timestamp]);
  }
}

export function expandTo18Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}


export const duration = {
  seconds: function (val: any) {
    return BigNumber.from(val)
  },
  minutes: function (val: any) {
    return BigNumber.from(val).mul(this.seconds("60"))
  },
  hours: function (val: any) {
    return BigNumber.from(val).mul(this.minutes("60"))
  },
  days: function (val: any) {
    return BigNumber.from(val).mul(this.hours("24"))
  },
  weeks: function (val: any) {
    return BigNumber.from(val).mul(this.days("7"))
  },
  years: function (val: any) {
    return BigNumber.from(val).mul(this.days("365"))
  },
}

export async function latest(provider: providers.Web3Provider) {
  const block = await provider.getBlock("latest")
  return BigNumber.from(block.timestamp)
}

export async function latestBlockNumber(provider: providers.Web3Provider) {
  const block = await provider.getBlock("latest")
  return BigNumber.from(block.number)
}

export async function increase(provider: providers.Web3Provider, inc: BigNumber) {
  await provider.send("evm_increaseTime", [inc.toNumber()])
  await advanceBlock(provider)
}


export async function advanceBlock(provider: providers.Web3Provider) {
  await provider.send("evm_mine", [])
}