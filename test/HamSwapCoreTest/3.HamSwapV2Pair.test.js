const { ethers, upgrades, network } = require("hardhat");
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require("chai");
const Web3 = require('web3');
const ether = require("@openzeppelin/test-helpers/src/ether");
const toWei = Web3.utils.toWei

describe("Test HamSwapV2Pair", ()=> {
    before(async()=> {
        this.signers = await ethers.getSigners()
        this.minter = this.signers[0]

        this.HamSwapV2Factory = await ethers.getContractFactory("HamSwapV2Factory")
        this.ERC20 = await ethers.getContractFactory("TestHamSwapV2ERC20")
        this.HamSwapV2Pair = await ethers.getContractFactory("HamSwapV2Pair")
    })
    beforeEach(async()=> {
        
        this.factory = await this.HamSwapV2Factory.deploy(this.minter.address)
        await this.factory.deployed()

        this.token0 = await this.ERC20.deploy(toWei("1000"))
        await this.token0.deployed();

        this.token1 = await this.ERC20.deploy(toWei("1000"))
        await this.token1.deployed();

        await this.factory.createPair(this.token0.address, this.token1.address, 10000)
        this.pair = await this.HamSwapV2Pair.attach(await this.factory.allPairs(0));
    })

    it("feeTo, feeToSetter, allPairsLength", async()=>{
        expect(await this.pair.name()).to.equal("HamSwap V2")
        expect(await this.pair.symbol()).to.equal("Ham-V2")
        expect(await this.pair.decimals()).to.equal(18)
        expect((await this.pair.totalSupply()).toString()).to.equal('0')
    })
})  