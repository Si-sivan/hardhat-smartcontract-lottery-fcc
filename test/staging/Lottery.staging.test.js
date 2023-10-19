const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Lottery Staging Tests", function () {
        let lottery, lotteryEntranceFee, deployer

        beforeEach(async function() {
            deployer = (await getNamedAccounts()).deployer
            lottery = await ethers.getContract("Lottery", deployer)
            lotteryEntranceFee = await lottery.getEntranceFee()
        })
        describe("fulfillRandomWords", function() {
            it("works with live Chainlink Automations and Chainlink VRF, we get a random winner", async function() {
                // enter the lottery（我们什么都不用做，只要进入抽奖就可以了，因为Chainlink Automations以及VRF才是为我们开奖的存在
                // 我们需要获取开始时的时间戳，因为一会儿我们要测试一下时间戳是否确实往前移动了
                const startingTimeStamp = await lottery.getLatestTimeStamp()
                const accounts = await ethers.getSigners()

                await new Promise (async (resolve, reject) => {
                // 1. setup listener before we enter the lottery
                // staging只需要加入奖池，后面就等chainlink自动触发定时抽奖和随机玩家产生以及奖金兑换
                    lottery.once("WinnerPicked", async() => {
                        console.log("WinnerPicked event fired!")
                        // 只有当我们获取到了这个WinnerPicked我们才开始执行这里的assert
                        // 我们要确保已经有一个优胜者，被验证过的优胜者，被选了出来，资金才会发生转移
                        resolve()
                        try {
                            const recentWinner = await lottery.getRecentWinner()
                            const lotteryState = await lottery.getLotteryState()
                            const winnerEndingBalance = await accounts[0].getBalance()
                            const endingTimeStamp = await lottery.getLatestTimeStamp()

                            // 首先我们应该预期抽奖已经被重置了
                            await expect(lottery.getPlayer(0)).to.be.reverted
                            assert.equal(recentWinner.toSting(), accounts[0].address)
                            assert.equal(lotteryState.toSting(), "0")
                            assert.equal(winnerEndingBalance.toSting(), (winnerStartingBalance + lotteryEntranceFee).toSting())
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve()  // 这些全部满足，我们就返回resolve, 如果这里面有任何一个assert出了问题，我们就catch这个错误，并返回reject
                        }catch(error) {
                            console.log(error)
                            reject(e)
                        }
                    })
                    // 2. then entering the lottery
                    await lottery.enterLottery({value: lotteryEntranceFee})
                    const winnerStartingBalance = await accounts[0].getBalance()


                    // 3. and this code WON'T complete until our listener has finished listening!
                })
            })
        })
    })