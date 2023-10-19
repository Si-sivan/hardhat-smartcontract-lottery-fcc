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
        // 在开发链上创建订阅
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        // 在transactionReceipt内部，实际上有一个事件，它会被我们获取的订阅触发
        subscriptionId = 1
        
        // 还需要资助该订阅
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    
    const entranceFee = networkConfig[chainId]["entranceFee"]
    const keyHash = networkConfig[chainId]["keyHash"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    // subscriptionId 通过vrf.chain.link获取
    const lottery = await deploy("Lottery", { // 这就是部署Lottery的方法，我们还需要为账户添加很多参数
        from: deployer,
        args:[vrfCoordinatorV2Address, entranceFee, keyHash, subscriptionId, callbackGasLimit, interval],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
   // if(chainId == 31337) {
     //   await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.target)
    //}

    // 添加验证环节
    if(!developmentChains.includes(network.name) && process.env.ETHEREUM_API_KEY) {
        log("Verifying...")
        await verify(lottery.target, [vrfCoordinatorV2Address, entranceFee, keyHash, subscriptionId, callbackGasLimit, interval])
    }
    log("----------------------------------------------")
}

module.exports.tags = ["all", "lottery"]