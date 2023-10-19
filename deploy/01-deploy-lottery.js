const { deployments, network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("30")

module.exports = async function({ getNamedAccounts, deployment}){
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId //, rfCoordinatorV2Mock
    

    if(developmentChains.includes(network.name)){ 
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = 1
        
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    
    const entranceFee = networkConfig[chainId]["entranceFee"]
    const keyHash = networkConfig[chainId]["keyHash"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    const lottery = await deploy("Lottery", { 
        from: deployer,
        args:[vrfCoordinatorV2Address, entranceFee, keyHash, subscriptionId, callbackGasLimit, interval],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if(!developmentChains.includes(network.name) && process.env.ETHEREUM_API_KEY) {
        log("Verifying...")
        await verify(lottery.target, [vrfCoordinatorV2Address, entranceFee, keyHash, subscriptionId, callbackGasLimit, interval])
    }
    log("----------------------------------------------")
}

module.exports.tags = ["all", "lottery"]
