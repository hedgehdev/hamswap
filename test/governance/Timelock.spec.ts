import chai, { expect } from 'chai'
import { Contract, Wallet, BigNumber, constants, utils } from 'ethers'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'


import { governanceFixture } from '../shared/fixtures'
import { DELAY, duration, expandTo18Decimals, increase, latest, latestBlockNumber } from '../utils'

import TestERC20 from '../../build/TestERC20.json'
import HogChef from '../../build/HogChef.json'

chai.use(solidity)

describe('Timelock', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet, alice, bob, carol, dev] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet, alice, bob, carol, dev], provider)

  let hog: Contract
  let timelock: Contract
  let governorAlpha: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(governanceFixture)
    hog = fixture.hog
    timelock = fixture.timelock
    governorAlpha = fixture.governorAlpha

  })

  it('timelock:shouldnot', async () => {
    await hog.transferOwnership(timelock.address)

    await expect(
      hog.transferOwnership(alice.address)
    ).to.be.revertedWith(
      'Ownable: caller is not the owner'
    )
    await expect(
      hog.connect(bob).transferOwnership(carol.address)
    ).to.be.revertedWith(
      'Ownable: caller is not the owner'
    )

    await expect(
      timelock.connect(carol).queueTransaction(
        hog.address,
        "0",
        "transferOwnership(address)",
        utils.defaultAbiCoder.encode(["address"], [carol.address]),
        (await latest(provider)).add(duration.days(4))
      )
    ).to.be.revertedWith("Timelock::queueTransaction: Call must come from admin.")
  })

  it('timelock:shoulddo', async () => {
    const lp1 = await deployContract(wallet, TestERC20, ["LPToken1", "LP1", "10000000000"])
    const lp2 = await deployContract(wallet, TestERC20, ["LPToken2", "LP2", "10000000000"])
    let blockNumber = await latestBlockNumber(provider);
    const chef = await deployContract(wallet, HogChef, [hog.address, dev.address, "1000", "10", blockNumber, blockNumber.add(1000)])

    await hog.mint(chef.address, expandTo18Decimals(10000*10))
    await chef.add("100", lp1.address, true)
    await chef.transferOwnership(timelock.address)
    const eta = (await latest(provider)).add(duration.days(4))
    await timelock
      .connect(wallet)
      .queueTransaction(
        chef.address,
        "0",
        "set(uint256,uint256,bool)",
        utils.defaultAbiCoder.encode(["uint256", "uint256", "bool"], ["0", "200", false]),
        eta
      )

    await timelock
      .connect(wallet)
      .queueTransaction(
        chef.address,
        "0",
        "add(uint256,address,bool)",
        utils.defaultAbiCoder.encode(["uint256", "address", "bool"], ["100", lp2.address, false]),
        eta
      )

    await increase(provider, duration.days(4))

    await timelock
      .connect(wallet)
      .executeTransaction(
        chef.address,
        "0",
        "set(uint256,uint256,bool)",
        utils.defaultAbiCoder.encode(["uint256", "uint256", "bool"], ["0", "200", false]),
        eta
      )

    await timelock
      .connect(wallet)
      .executeTransaction(
        chef.address,
        "0",
        "add(uint256,address,bool)",
        utils.defaultAbiCoder.encode(["uint256", "address", "bool"], ["100", lp2.address, false]),
        eta
      )

    expect((await chef.poolInfo("0")).allocPoint).to.eq("200")
    expect(await chef.totalAllocPoint()).to.equal("300")
    expect(await chef.poolLength()).to.be.eq(2)
  })


})