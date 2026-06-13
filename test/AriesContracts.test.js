const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Aries Network Smart Contracts", function () {
  let deployer;
  let validator1;
  let validator2;
  let delegator1;
  let randomUser;
  let masterWallet;

  let registry;
  let portal;
  let games;

  const MIN_STAKE = ethers.parseEther("51000");

  beforeEach(async function () {
    [deployer, validator1, validator2, delegator1, randomUser, masterWallet] = await ethers.getSigners();

    // 1. Deploy ValidatorRegistry
    const ValidatorRegistry = await ethers.getContractFactory("AriesValidatorRegistry");
    registry = await ValidatorRegistry.deploy(
      [validator1.address, validator2.address],
      [MIN_STAKE, MIN_STAKE]
    );
    await registry.waitForDeployment();

    // 2. Deploy PortalWallet
    const PortalWallet = await ethers.getContractFactory("AriesPortalWallet");
    portal = await PortalWallet.deploy(masterWallet.address);
    await portal.waitForDeployment();

    // 3. Deploy Games and fund it with 1,000 native tokens
    const Games = await ethers.getContractFactory("AriesGames");
    games = await Games.deploy({ value: ethers.parseEther("1000") });
    await games.waitForDeployment();
  });

  describe("AriesValidatorRegistry", function () {
    it("should initialize with initial validators", async function () {
      const active = await registry.getActiveValidators();
      expect(active.length).to.equal(2);
      expect(active[0]).to.equal(validator1.address);
      expect(active[1]).to.equal(validator2.address);

      const val1Info = await registry.validators(validator1.address);
      expect(val1Info.isEligible).to.be.true;
      expect(val1Info.selfStake).to.equal(MIN_STAKE);
    });

    it("should allow a new validator to register with sufficient stake", async function () {
      // msg.sender = randomUser, value >= MIN_STAKE
      await expect(registry.connect(randomUser).registerValidator({ value: MIN_STAKE }))
        .to.emit(registry, "ValidatorRegistered")
        .withArgs(randomUser.address, MIN_STAKE);

      const valInfo = await registry.validators(randomUser.address);
      expect(valInfo.isEligible).to.be.true;
      expect(valInfo.selfStake).to.equal(MIN_STAKE);
    });

    it("should fail registration if stake is below minimum", async function () {
      const lowStake = ethers.parseEther("50000");
      await expect(registry.connect(randomUser).registerValidator({ value: lowStake }))
        .to.be.revertedWith("Insufficient minimum stake");
    });

    it("should allow delegators to delegate stake to validators", async function () {
      const delegationAmount = ethers.parseEther("1000");
      await expect(registry.connect(delegator1).delegate(validator1.address, { value: delegationAmount }))
        .to.emit(registry, "Delegated")
        .withArgs(delegator1.address, validator1.address, delegationAmount);

      const valInfo = await registry.validators(validator1.address);
      expect(valInfo.delegatedStake).to.equal(delegationAmount);
      expect(valInfo.totalStake).to.equal(MIN_STAKE + delegationAmount);

      expect(await registry.delegations(delegator1.address, validator1.address)).to.equal(delegationAmount);
    });

    it("should allow unstaking self-stake and update eligibility", async function () {
      // Register randomUser first
      await registry.connect(randomUser).registerValidator({ value: MIN_STAKE });

      // Unstake 1000 ARES, leaving 50,000 ARES (below MIN_STAKE)
      const unstakeAmount = ethers.parseEther("1000");
      await expect(registry.connect(randomUser).unstake(unstakeAmount))
        .to.emit(registry, "Unstaked")
        .withArgs(randomUser.address, unstakeAmount);

      const valInfo = await registry.validators(randomUser.address);
      expect(valInfo.selfStake).to.equal(MIN_STAKE - unstakeAmount);
      expect(valInfo.isEligible).to.be.false; // Stake is below MIN_STAKE
    });

    it("should allow undelegation", async function () {
      const delegationAmount = ethers.parseEther("2000");
      await registry.connect(delegator1).delegate(validator1.address, { value: delegationAmount });

      // Undelegate 1000
      const undelegateAmount = ethers.parseEther("1000");
      await expect(registry.connect(delegator1).undelegate(validator1.address, undelegateAmount))
        .to.emit(registry, "Undelegated")
        .withArgs(delegator1.address, validator1.address, undelegateAmount);

      expect(await registry.delegations(delegator1.address, validator1.address)).to.equal(delegationAmount - undelegateAmount);
    });
  });

  describe("AriesPortalWallet", function () {
    it("should immediately forward native token deposits to the master wallet", async function () {
      const depositAmount = ethers.parseEther("5");

      const masterBalanceBefore = await ethers.provider.getBalance(masterWallet.address);

      // Send transaction directly to portal wallet contract address
      const tx = await randomUser.sendTransaction({
        to: await portal.getAddress(),
        value: depositAmount
      });
      await tx.wait();

      const masterBalanceAfter = await ethers.provider.getBalance(masterWallet.address);
      expect(masterBalanceAfter - masterBalanceBefore).to.equal(depositAmount);
      
      const portalBalance = await ethers.provider.getBalance(await portal.getAddress());
      expect(portalBalance).to.equal(0n);
    });
  });

  describe("AriesGames", function () {
    it("should allow a user to play scratch card and receive prizes", async function () {
      const userBalanceBefore = await ethers.provider.getBalance(randomUser.address);
      
      const tx = await games.connect(randomUser).playScratchCard();
      const receipt = await tx.wait();
      
      // Calculate transaction fees to do exact verification
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const userBalanceAfter = await ethers.provider.getBalance(randomUser.address);

      // Verify user received prize
      const events = await games.queryFilter(games.filters.ScratchCardPlayed(randomUser.address));
      expect(events.length).to.equal(1);
      const prize = events[0].args.prizeAmount;
      expect(prize).to.be.within(ethers.parseEther("1"), ethers.parseEther("10"));

      expect(userBalanceAfter).to.equal(userBalanceBefore + prize - gasUsed);
    });

    it("should enforce cooldown on playing scratch card twice in same day", async function () {
      await games.connect(randomUser).playScratchCard();
      await expect(games.connect(randomUser).playScratchCard())
        .to.be.revertedWith("Daily scratch card already claimed");
    });

    it("should allow user to spin the wheel and get a coupon code", async function () {
      await expect(games.connect(randomUser).spinWheel())
        .to.emit(games, "WheelSpun");
        
      // Check event content
      const events = await games.queryFilter(games.filters.WheelSpun(randomUser.address));
      expect(events.length).to.equal(1);
      expect(events[0].args.couponCode).to.be.a("string");
    });

    it("should enforce cooldown on spin wheel", async function () {
      await games.connect(randomUser).spinWheel();
      await expect(games.connect(randomUser).spinWheel())
        .to.be.revertedWith("Daily wheel spin already used");
    });

    it("should allow owner to update prize range", async function () {
      const min = ethers.parseEther("2");
      const max = ethers.parseEther("20");
      await expect(games.connect(deployer).setScratchCardPrizeRange(min, max))
        .to.emit(games, "PrizeRangeUpdated")
        .withArgs(min, max);
    });

    it("should restrict owner functions to the owner", async function () {
      await expect(games.connect(randomUser).setScratchCardPrizeRange(1, 2))
        .to.be.revertedWith("Not owner");
    });
  });
});
