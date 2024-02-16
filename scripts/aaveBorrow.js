const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()

    //Here, we need to pass signer rather than deployer(as in PAtrick's video), as we need a signer to sign this "getContractAt" transaction.
    const signer = await ethers.provider.getSigner()

    const lendingPool = await getLendingPool(signer)
    console.log(`LendingPool addresss: ${lendingPool.target}`) //Use "lendingPool.target" instead of "lendingPool.address". This gives the same address.

    //Deposit -----
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    //Approve
    await approveERC20(wethTokenAddress, lendingPool, AMOUNT, signer)
    console.log("Depositing...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Deposited!")

    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)

    //Getting DAI PRICE
    const daiPrice = await getDaiPrice()
    const amountDaiToBorrow = (availableBorrowsETH.toString() * 0.95) / daiPrice.toString()
    console.log(`You can Borrow ${amountDaiToBorrow} DAI`)

    const amountDaiToBorrowWei = ethers.parseEther(amountDaiToBorrow.toString())
    console.log(amountDaiToBorrowWei)

    //Borrow -----
    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"

    await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)
    await getBorrowUserData(lendingPool, deployer)

    // Repay------
    await repay(daiTokenAddress, lendingPool, amountDaiToBorrowWei, signer)
    await getBorrowUserData(lendingPool, deployer)
}

async function repay(daiAddress, lendingPool, amount, account) {
    await approveERC20(daiAddress, lendingPool, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, 2, account)
    await repayTx.wait(1)
    console.log("Repaid!")
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrow, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrow, 2, 0, account)
    await borrowTx.wait(1)
    console.log("You've borrowed!")
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4",
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`The DAI/ETH price is ${price.toString()}`)

    return price
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log(`You have ${totalCollateralETH} worth of ETH deposited.`)
    console.log(`Yoy have ${totalDebtETH} worth of ETH borrowed.`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`)

    return { totalDebtETH, availableBorrowsETH }
}

async function getLendingPool(account) {
    //aave lendingPoolAddressProvider address 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account,
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()

    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)

    return lendingPool
}

async function approveERC20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("Approved!")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
