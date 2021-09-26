const { ethers, upgrades, network } = require("hardhat");
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require("chai");
const Web3 = require('web3');
const ether = require("@openzeppelin/test-helpers/src/ether");
const toWei = Web3.utils.toWei

describe("Test HamSwapV2ERC20", ()=> {
    beforeEach(async()=> {
        this.signers = await ethers.getSigners()
        this.minter = this.signers[0]
        this.ERC20 = await ethers.getContractFactory("TestHamSwapV2ERC20")
        this.token = await this.ERC20.deploy(toWei("1000"))
        await this.token.deployed();
    })

    it("name, symbol, decimals, totalSupply, balanceOf", async()=>{
        expect(await this.token.name()).to.equal("HamSwap V2")
        expect(await this.token.symbol()).to.equal("Ham-V2")
        expect(await this.token.decimals()).to.equal(18)
        expect((await this.token.totalSupply()).toString()).to.equal(toWei("1000"))
        expect((await this.token.balanceOf(this.minter.address)).toString()).to.equal(toWei("1000"))
    })
})  