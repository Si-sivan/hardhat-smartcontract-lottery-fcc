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
                // enter the lottey
                const startingTimeStamp = await lottery.getLatestTimeStamp()
                const accounts = await ethers.getSigners()

                await new Promise (async (resolve, reject) => {
                // 1. setup listener before we enter the lottery
                    lottery.once("WinnerPicked", async() => {
                        console.log("WinnerPicked event fired!")
                        resolve()
                        try {
                            const recentWinner = await lottery.getRecentWinner()
                            const lotteryState = await lottery.getLotteryState()
                            const winnerEndingBalance = await accounts[0].getBalance()
                            const endingTimeStamp = await lottery.getLatestTimeStamp()
                            await expect(lottery.getPlayer(0)).to.be.reverted
                            assert.equal(recentWinner.toSting(), accounts[0].address)
                            assert.equal(lotteryState.toSting(), "0")
                            assert.equal(winnerEndingBalance.toSting(), (winnerStartingBalance + lotteryEntranceFee).toSting())
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve()  
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
