const { ethers } = require("hardhat")
const {developmentChains} = require("../helper-hardhat-config.js")

const BASE_FEE = ethers.parseEther("0.25")  // 0.25是一个保底费用，每次请求花费0.25LINK
const GAS_PRICE_LINK = 1e9 // link per gas这是一个基于所在链gas价格的计算值
// 在返回随机数以及执行Upkeep等操作时，实际上支付gas费的是Chainlink节点

module.exports = async function({getNamedAccounts, deployments}){
    const {deploy, log} = deployments
    const {deployer} = await getNamedAccounts()
    // 接下来我们需要获取”chainId",因为我们只想把这个部署到开发链上
    const chainId = network.config.chainId
    // 现在我们只想在开发链上部署mock
    
    if(developmentChains.includes(network.name)){
        log("Local network detected! Deploying mocks...")
        // 我们要部署一个模拟的vrfcoordinator
        await deploy("VRFCoordinatorV2Mock",{
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("Mocks Deployed!")
        log("-----------------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
// 现在有了一个完成部署的“VRFCoordinatorV2Mock"