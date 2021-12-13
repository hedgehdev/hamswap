import chai, { expect } from 'chai'
import { Contract, Wallet, BigNumber, constants, utils } from 'ethers'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'


import { vestingFixture } from './shared/fixtures'
import { DELAY, duration, expandTo18Decimals, increase, latest, latestBlockNumber } from './utils'


chai.use(solidity)


describe('HogVesting', () => {
    const provider = new MockProvider({
      ganacheOptions: {
        hardfork: 'istanbul',
        mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
        gasLimit: 9999999,
      },
    })
    const [wallet, alice, bob, carol] = provider.getWallets()
    const loadFixture = createFixtureLoader([wallet], provider)
  
    let token: Contract
    let vesting: Contract
    beforeEach(async () => {
      const fixture = await loadFixture(vestingFixture)
      token = fixture.token
      vesting = fixture.vesting
      expect(await token.totalSupply()).to.be.eq(await token.balanceOf(wallet.address))
    })
    /*
    * TEST SUMMARY
    * deploy vesting contract
    * send tokens to vesting contract
    * create new vesting schedule (100 tokens)
    * check that vested amount is 0
    * set time to half the vesting period
    * check that vested amount is half the total amount to vest (50 tokens)
    * check that only beneficiary can try to release vested tokens
    * check that beneficiary cannot release more than the vested amount
    * release 10 tokens and check that a Transfer event is emitted with a value of 10
    * check that the released amount is 10
    * check that the vested amount is now 40
    * set current time after the end of the vesting period
    * check that the vested amount is 90 (100 - 10 released tokens)
    * release all vested tokens (90)
    * check that the number of released tokens is 100
    * check that the vested amount is 0
    * check that anyone cannot revoke a vesting
    */
    it('vest:works', async () => {
      expect(await vesting.getToken()).to.be.eq(token.address)
      // send tokens to vesting contract
      let vestInAmount = BigNumber.from(1000)
      await expect(token.connect(wallet).transfer(vesting.address, vestInAmount))
        .to.emit(token, "Transfer")
        .withArgs(wallet.address, vesting.address, vestInAmount)
      expect(await token.balanceOf(vesting.address)).to.be.eq(vestInAmount)
      expect(await vesting.getWithdrawableAmount()).to.be.eq(vestInAmount)
    
      const baseTime = await latest(provider)
      const beneficiary = alice.address
      const startTime = baseTime
      const cliff = 0
      const vestingDuration = 1000
      const slicePeriodSeconds = 1;
      const revokable = true;
      const amount = 100
      await vesting.createVestingSchedule(
          beneficiary,
          startTime,
          cliff,
          vestingDuration,
          slicePeriodSeconds,
          revokable,
          amount
      )

      await increase(provider, duration.seconds(BigNumber.from(vestingDuration).div(2)))
      
      const vestingScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary, 0)
      await expect(vesting.revoke(vestingScheduleId))
        .to.emit(token, "Transfer")
        .withArgs(vesting.address, beneficiary, BigNumber.from(amount).div(2))

    })
  
    it('vest:createVestingSchedule:param:check', async () => {
      let vestInAmount = BigNumber.from(1000)
      await expect(vesting.createVestingSchedule(
          alice.address,
          await latest(provider),
          0,
          0,
          1,
          true,
          vestInAmount
      )).to.be.revertedWith("HogVesting: cannot create vesting schedule because not sufficient tokens")

      await expect(token.connect(wallet).transfer(vesting.address, vestInAmount))
      .to.emit(token, "Transfer")
      .withArgs(wallet.address, vesting.address, vestInAmount)

      await expect(vesting.createVestingSchedule(
        alice.address,
        await latest(provider),
        0,
        0,
        1,
        true,
        vestInAmount
      )).to.be.revertedWith("HogVesting: duration must be > 0")


      await expect(vesting.createVestingSchedule(
        alice.address,
        await latest(provider),
        0,
        1,
        0,
        true,
        vestInAmount
      )).to.be.revertedWith("HogVesting: slicePeriodSeconds must be >= 1")

      await expect(vesting.createVestingSchedule(
        alice.address,
        await latest(provider),
        0,
        1,
        0,
        true,
        0
      )).to.be.revertedWith("HogVesting: amount must be > 0")
    })
  
    it('gov:governor', async () => {
      
    })
  })