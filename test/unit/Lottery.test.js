const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name) 
   ? describe.skip 
   : describe("Lottery Unit Tests", function () {
    // 我们需要部署lottery, vrfCoordinatorV2Mock
        let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer,interval
        const chainId = network.config.chainId

        beforeEach(async function() {
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            lottery = await ethers.getContract("Lottery", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            lotteryEntranceFee = await lottery.getEntranceFee()
            interval = await lottery.getInterval()
       })
     
        describe("constructor", function() {
            it("initializes the lottery correctly", async function() {
                // 理想情况下，我们要让测试中的每个“it”都只拥有一处断言//"^2.2.3",
                const lotteryState = await lottery.getLotteryState()
                const interval = await lottery.getInterval()
                assert.equal(lotteryState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })
        })
        
        describe("enterLottery", function() {
            it("reverts when you don't pay enough", async function() {
                await expect(lottery.enterLottery()).to.be.revertedWithCustomError(lottery,"Lottery__NotEnoughETHEntered")
               
            })
            it("records players when they enter", async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                const playerFromContract = await lottery.getPlayers(0)
                assert.equal(playerFromContract, deployer)
            })
            it("emits event on enter", async function() {
                await expect(lottery.enterLottery({value: lotteryEntranceFee})).to.emit(lottery, "LotteryEnter")
            })
            it("doesn't allow entrance when lottery is calculating", async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1]) // 为我们的区块链增加了时间
                await network.provider.send("evm_mine", []) // 向前挖了一个区块
                // we pretend to be a chainlink automation
                await lottery.performUpkeep("0x")
                await expect(lottery.enterLottery({value: lotteryEntranceFee})).to.be.revertedWithCustomError(lottery,"Lottery__NotOpen")

            })
            // hardhat 内置了大量的函数，让我们可以控制区块链以达到我们想要的目的 hardhat.org/hardhat-network/reference/其中
            // 有大量有关hardhat网络如何运作以及我们能做哪些配置的信息
        })
        describe("checkUpkeep", function() {
            it("returns false if people have't sent any ETH", async function() {
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                const {upkeepNeeded} = await lottery.checkUpkeep.staticCall("0x")
                //const {upkeepNeeded} = await lottery.callStatic.checkUpkeep("0x") // 它会返回upkeepNeeded以及bytes performData
                // 并不想真的发送交易，我们想要模拟发送交易，然后看一下“upkeepNeeded"会返回什么，可以通过staticCall来实现这一操作
                // 我们可以模拟调用这笔交易，然后看看它会有什么回应
                assert(!upkeepNeeded)
            })
            it("returns false if lottery isn't open", async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                await lottery.performUpkeep("0x")
                const lotteryState = await lottery.getLotteryState()
                const {upkeepNeeded} = await lottery.checkUpkeep.staticCall("0x")
                assert.equal(lotteryState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })
            it("returns false if enough time hasn't passed", async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) - 1])
                await network.provider.request({method: "evm_mine", params: []})
                const {upkeepNeeded} = await lottery.checkUpkeep.staticCall("0x")
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({method: "evm_mine", params: []})
                const {upkeepNeeded} = await lottery.checkUpkeep.staticCall("0x")
                assert(upkeepNeeded)
            } )
        })
        describe("performUpkeep", function() {
            it("it can only run if checkUpkeep is true", async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                const tx = await lottery.performUpkeep("0x")
                assert(tx)
            })
            it("reverts when checkUpkeep is false", async function() {
                await expect(lottery.performUpkeep("0x")).to.be.revertedWithCustomError(lottery, "Lottery__UpkeepNotNeeded")
            })
            it("updates the lottery state,emits and event, and calls the vrf coordinator", async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                const txResponse = await lottery.performUpkeep("0x")
                const txReceipt = await txResponse.wait(1)
                const requestId = txReceipt.logs[1].args.requestId
                const lotteryState = await lottery.getLotteryState()
                assert(requestId.toString() > "0")
                assert.equal(lotteryState.toString(), "1")

            })
        })
        describe("fulfillRandomWords", function() {
            // 在这里我们要添加一个新的”beforeEach",我们希望在这里的测试运行之前，就已经有人进入到抽奖里了
            beforeEach(async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
            })
            it("can only be called after performUpkeep", async function() {
                // 一种测试大量此类变量的方法，它被称为“fuzz testing"(模糊测试)
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.target)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.target)).to.be.revertedWith("nonexistent request")
            })
            it("picks a winner, resets the lottery, and sends money", async function() {
                // 对于这个测试来说，我们需要添加一些额外的参与者
                const additionalEntrants = 3
                // 我们需要从ethers中获取一些额外的虚拟账户来参与到我们的抽奖中来
                const startingAcountIndex = 1 // deployer = 0
                let accounts = await ethers.getSigners()
                for(let i = startingAcountIndex; i < startingAcountIndex + additionalEntrants; i++){
                    const accountConnectdLottery = lottery.connect(accounts[i])
                    await accountConnectdLottery.enterLottery({value: lotteryEntranceFee})
                }
                const startingTimeStamp = await lottery.getLatestTimeStamp()
                // 我们想要执行performUpkeep, 它用于模拟Chainlink Keepers
                // 它会启动调用fulfillRandomWords,同样是模拟做一些事情，模拟chainlink VRF
                // 如果是在测试网上，我们需要等待fulfillRandomWords调用完毕
                // 先订阅再触发，同时这些都在promise里面
                await new Promise(async (resolve, reject) => {
                    console.log("Found the event!")
                    lottery.once("WinnerPicked", async() => {
                        try{
                            const recentWinner = await lottery.getRecentWinner()
                            console.log(recentWinner)
                            console.log(accounts[0].address)
                            console.log(accounts[1].address)
                            console.log(accounts[2].address)
                            console.log(accounts[3].address)
                            const lotteryState = await lottery.getLotteryState()
                            const endingTimeStamp = await lottery.getLatestTimeStamp()
                            const numberPlayers = await lottery.getNumberOfPlayers()
                            const winnerEndingBalance = await account[1].getBalance()
                            assert.equal(numberPlayers.toString(), "0")
                            assert.equal(lotteryState.toString(), "0")
                            assert(endingTimeStamp > startingTimeStamp)

                            assert.equal(
                                winnerEndingBalance.toString(), 
                                (winnerStartingBalance 
                                    + lotteryEntranceFee 
                                    * additionalEntrants 
                                    + lotteryEntranceFee)
                                    .toString())
                        } catch(e){
                            reject(e)
                        }                        
                        resolve()
                    })
                    // setting up the listenr
                    // below, we will fire the event, and the listener will pick it up, and resolve
                    const tx = await lottery.performUpkeep("0x")
                    const txReceipt = await tx.wait(1)
                    const winnerStartingBalance = await accounts[1].getBalance()
                    await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.logs[1].args.requestId, lottery.target)

                })
            })
        }) 
  })