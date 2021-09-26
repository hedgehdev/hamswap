const { ethers, upgrades, network } = require("hardhat");
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require("chai");
const Web3 = require('web3');
const ether = require("@openzeppelin/test-helpers/src/ether");
const toWei = Web3.utils.toWei

describe("Test HamSwapV2Factory", ()=> {
    beforeEach(async()=> {
        this.signers = await ethers.getSigners()
        this.minter = this.signers[0]
        this.HamSwapV2Factory = await ethers.getContractFactory("HamSwapV2Factory")
        this.ERC20 = await ethers.getContractFactory("TestHamSwapV2ERC20")
        
        this.factory = await this.HamSwapV2Factory.deploy(this.minter.address)
        await this.factory.deployed()

        this.token = await this.ERC20.deploy(toWei("1000"))
        await this.token.deployed();
    })

    it("feeTo, feeToSetter, allPairsLength", async()=>{
        expect(await this.factory.feeTo()).to.equal(ethers.constants.AddressZero)
        expect(await this.factory.feeToSetter()).to.equal(this.minter.address)
        expect(await this.factory.allPairsLength()).to.equal(0)
    })
})  