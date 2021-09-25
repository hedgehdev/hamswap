require("@nomiclabs/hardhat-waffle");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 const utils = require('./scripts/utils')
 const config = utils.getConfig();
 module.exports = {

  networks: {
    ropsten:  {
      url: `https://ropsten.infura.io/v3/${config.ropsten.infuraKey}`,
      accounts: [`0x${config.ropsten.privateKeys[0]}`, `0x${config.ropsten.privateKeys[1]}`],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${config.ropsten.infuraKey}`,
      accounts: [`0x${config.ropsten.privateKeys[0]}`, `0x${config.ropsten.privateKeys[1]}`],
    },
    // mainnet: {
    //   url: `https://eth-mainnet.alchemyapi.io/v2/${config.ropsten.alchemyApiKey}`,
    //   accounts: [`0x${process.env.DEV_PRIVATE_KEY}`],
    // },

    // hardhat: {
    //   mining: {
    //     auto: true,
    //   },
    //   forking: {
    //     url: `https://mainnet.infura.io/v3/${config.mainnet.infuraKey}`, // put your infura key
    //     // blockNumber: 12867134,                                        // putting historical block number requires archive node
    //   },
    // },

    // ropsten:  {
    //   url: `https://eth-ropsten.alchemyapi.io/v2/${config.ropsten.alchemyApiKey}`,
    //   accounts: [`0x${config.ropsten.privateKeys[0]}`, `0x${config.ropsten.privateKeys[1]}`],
    // },

    local: {
      // need to run local node manually
      url: "http://localhost:8545",
      allowUnlimitedContractSize: true,
      timeout: 2800000,
    },
  },
  etherscan: {
    apiKey: `${config.etherScanApiKey}`,
  },
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true, // true for release, false is default for debug and test
            runs: 1000,
          },
        },
      },
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true, // for weth when testing
            runs: 200,
          },
        },
      }
    ]
    
  },
};
