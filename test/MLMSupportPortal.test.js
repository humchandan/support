const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Aries MLM Support Portal & Utility Factory", function () {
  let deployer;
  let signerWallet;
  let feeRecipient;
  let masterWallet;
  let user1;
  let user2;
  let utilityWallet;
  
  let portal;
  let factory;

  const MIN_PURCHASE = ethers.parseEther("1000"); // 1,000 ARES
  const VALID_PURCHASE = ethers.parseEther("1500"); // 1,500 ARES (multiple of 100)
  const INVALID_PURCHASE_LOW = ethers.parseEther("500"); // 500 ARES
  const INVALID_PURCHASE_INC = ethers.parseEther("1050"); // 1,050 ARES (not multiple of 100)

  beforeEach(async function () {
    [deployer, feeRecipient, masterWallet, user1, user2, utilityWallet] = await ethers.getSigners();

    // Create a random wallet to act as the backend signer
    signerWallet = ethers.Wallet.createRandom();

    // 1. Deploy Support Portal
    const AriesSupportPortal = await ethers.getContractFactory("AriesSupportPortal");
    portal = await AriesSupportPortal.deploy(signerWallet.address, feeRecipient.address);
    await portal.waitForDeployment();

    // Fund the portal contract reserve with 10,000 ARES for testing payouts
    const fundTx = await deployer.sendTransaction({
      to: await portal.getAddress(),
      value: ethers.parseEther("10000")
    });
    await fundTx.wait();

    // 2. Deploy Utility Factory
    const PortalFactory = await ethers.getContractFactory("PortalFactory");
    factory = await PortalFactory.deploy(masterWallet.address);
    await factory.waitForDeployment();
  });

  describe("AriesSupportPortal - Purchase Plan", function () {
    it("should accept valid purchases", async function () {
      await expect(portal.connect(user1).purchasePlan({ value: MIN_PURCHASE }))
        .to.emit(portal, "PlanPurchased")
        .withArgs(user1.address, MIN_PURCHASE, anyValue => true);

      let info = await portal.userPlans(user1.address);
      expect(info.totalDeposited).to.equal(MIN_PURCHASE);

      // Top up with another valid amount (must also be >= 1000 ARES)
      const topUpAmount = ethers.parseEther("1200");
      await portal.connect(user1).purchasePlan({ value: topUpAmount });
      info = await portal.userPlans(user1.address);
      expect(info.totalDeposited).to.equal(MIN_PURCHASE + topUpAmount);
    });

    it("should revert on low purchases", async function () {
      await expect(portal.connect(user1).purchasePlan({ value: INVALID_PURCHASE_LOW }))
        .to.be.revertedWith("Minimum purchase is 1000 ARES");
    });

    it("should revert if amount is not multiple of 100 ARES", async function () {
      await expect(portal.connect(user1).purchasePlan({ value: INVALID_PURCHASE_INC }))
        .to.be.revertedWith("Purchase must be in multiples of 100 ARES");
    });
  });

  describe("AriesSupportPortal - Claim Rewards & Caps", function () {
    let deadline;
    let totalEligible;

    beforeEach(async function () {
      // User 1 buys a plan of 1,000 ARES
      await portal.connect(user1).purchasePlan({ value: MIN_PURCHASE });
      deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    });

    // Helper to generate signature
    async function signClaim(user, utility, eligible, deadlineVal, portalAddress) {
      const hash = ethers.solidityPackedKeccak256(
        ["address", "address", "uint256", "uint256", "address"],
        [user, utility, eligible, deadlineVal, portalAddress]
      );
      const signature = await signerWallet.signMessage(ethers.getBytes(hash));
      return signature;
    }

    it("should process claims successfully with 10% fee and 50/50 split", async function () {
      totalEligible = ethers.parseEther("500"); // Under the 2,000 ARES cap (2x of 1,000)
      const sig = await signClaim(user1.address, utilityWallet.address, totalEligible, deadline, await portal.getAddress());

      const initialUserBalance = await ethers.provider.getBalance(user1.address);
      const initialUtilityBalance = await ethers.provider.getBalance(utilityWallet.address);
      const initialFeeBalance = await ethers.provider.getBalance(feeRecipient.address);

      const tx = await portal.connect(user1).claimRewards(
        utilityWallet.address,
        totalEligible,
        deadline,
        sig
      );
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check storage updated
      const info = await portal.userPlans(user1.address);
      expect(info.totalClaimed).to.equal(totalEligible);

      // Verify payouts:
      // Gross = 500 ARES. Fee = 10% (50 ARES). Net = 450 ARES.
      // Split = 225 ARES to user, 225 ARES to utility.
      const expectedUserDiff = ethers.parseEther("225") - gasUsed;
      const expectedUtilityDiff = ethers.parseEther("225");
      const expectedFeeDiff = ethers.parseEther("50");

      const finalUserBalance = await ethers.provider.getBalance(user1.address);
      const finalUtilityBalance = await ethers.provider.getBalance(utilityWallet.address);
      const finalFeeBalance = await ethers.provider.getBalance(feeRecipient.address);

      expect(finalUserBalance - initialUserBalance).to.equal(expectedUserDiff);
      expect(finalUtilityBalance - initialUtilityBalance).to.equal(expectedUtilityDiff);
      expect(finalFeeBalance - initialFeeBalance).to.equal(expectedFeeDiff);
    });

    it("should revert if deadline expired", async function () {
      totalEligible = ethers.parseEther("500");
      const expiredDeadline = Math.floor(Date.now() / 1000) - 10;
      const sig = await signClaim(user1.address, utilityWallet.address, totalEligible, expiredDeadline, await portal.getAddress());

      await expect(portal.connect(user1).claimRewards(
        utilityWallet.address,
        totalEligible,
        expiredDeadline,
        sig
      )).to.be.revertedWith("Signature expired");
    });

    it("should revert if claim exceeds 2x cap", async function () {
      // Cap is 2,000 ARES (2x of 1,000)
      totalEligible = ethers.parseEther("2001");
      const sig = await signClaim(user1.address, utilityWallet.address, totalEligible, deadline, await portal.getAddress());

      await expect(portal.connect(user1).claimRewards(
        utilityWallet.address,
        totalEligible,
        deadline,
        sig
      )).to.be.revertedWith("Exceeds 2x payout cap");
    });

    it("should allow claiming incremental rewards up to the cap", async function () {
      // Claim 1: 1,500 ARES
      totalEligible = ethers.parseEther("1500");
      let sig = await signClaim(user1.address, utilityWallet.address, totalEligible, deadline, await portal.getAddress());
      await portal.connect(user1).claimRewards(utilityWallet.address, totalEligible, deadline, sig);

      let info = await portal.userPlans(user1.address);
      expect(info.totalClaimed).to.equal(totalEligible);

      // Claim 2: Try to claim the same amount again -> Should revert
      await expect(portal.connect(user1).claimRewards(utilityWallet.address, totalEligible, deadline, sig))
        .to.be.revertedWith("No new rewards to claim");

      // Claim 3: Claim up to the 2,000 cap -> payout 500 ARES
      totalEligible = ethers.parseEther("2000");
      sig = await signClaim(user1.address, utilityWallet.address, totalEligible, deadline, await portal.getAddress());
      await portal.connect(user1).claimRewards(utilityWallet.address, totalEligible, deadline, sig);

      info = await portal.userPlans(user1.address);
      expect(info.totalClaimed).to.equal(totalEligible);
    });

    it("should lock claims once 2x cap is hit, and unlock after a Top-Up", async function () {
      // Hit the 2x cap (2,000 ARES)
      totalEligible = ethers.parseEther("2000");
      let sig = await signClaim(user1.address, utilityWallet.address, totalEligible, deadline, await portal.getAddress());
      await portal.connect(user1).claimRewards(utilityWallet.address, totalEligible, deadline, sig);

      // Now user has earned more commissions off-chain, making totalEligible = 2,500
      totalEligible = ethers.parseEther("2500");
      sig = await signClaim(user1.address, utilityWallet.address, totalEligible, deadline, await portal.getAddress());

      // Attempt to claim 2,500 -> Reverted because it exceeds the current 2,000 cap
      await expect(portal.connect(user1).claimRewards(utilityWallet.address, totalEligible, deadline, sig))
        .to.be.revertedWith("Exceeds 2x payout cap");

      // Top up: User buys a new plan of 1,000 ARES (Total Deposited = 2,000, New Cap = 4,000)
      await portal.connect(user1).purchasePlan({ value: MIN_PURCHASE });

      // Attempt claim of 2,500 again -> Succeeds! Net payout: 2,500 - 2,000 = 500 ARES.
      await expect(portal.connect(user1).claimRewards(utilityWallet.address, totalEligible, deadline, sig))
        .to.emit(portal, "RewardsClaimed");

      const info = await portal.userPlans(user1.address);
      expect(info.totalClaimed).to.equal(totalEligible);
    });
  });

  describe("PortalFactory & AriesPortalWallet clones", function () {
    it("should deploy a unique user portal wallet and auto-forward deposits to masterWallet", async function () {
      const userId = ethers.id("user_profile_1");
      
      // Predict/create proxy
      const tx = await factory.createPortal(userId);
      const receipt = await tx.wait();
      
      // Get proxy address from event
      const events = await factory.queryFilter(factory.filters.PortalCreated(userId));
      expect(events.length).to.equal(1);
      const portalProxyAddress = events[0].args.portalAddress;
      expect(portalProxyAddress).to.be.a("string");
      expect(portalProxyAddress).to.not.equal(ethers.ZeroAddress);

      // Send ARES directly to the user's proxy wallet
      const depositAmount = ethers.parseEther("12.5");
      const initialMasterBalance = await ethers.provider.getBalance(masterWallet.address);

      const sendTx = await user1.sendTransaction({
        to: portalProxyAddress,
        value: depositAmount
      });
      await sendTx.wait();

      // Verify masterWallet received the forwarded funds
      const finalMasterBalance = await ethers.provider.getBalance(masterWallet.address);
      expect(finalMasterBalance - initialMasterBalance).to.equal(depositAmount);

      // Verify proxy wallet has 0 balance remaining
      const proxyBalance = await ethers.provider.getBalance(portalProxyAddress);
      expect(proxyBalance).to.equal(0n);
    });

    it("should allow owner to update the masterWallet destination", async function () {
      const newMaster = user2.address;
      
      await expect(factory.connect(deployer).setMasterWallet(newMaster))
        .to.emit(factory, "MasterWalletUpdated")
        .withArgs(masterWallet.address, newMaster);
        
      expect(await factory.masterWallet()).to.equal(newMaster);

      // Deploy proxy and verify it forwards to newMaster
      const userId = ethers.id("user_profile_2");
      const tx = await factory.createPortal(userId);
      await tx.wait();

      const events = await factory.queryFilter(factory.filters.PortalCreated(userId));
      const portalProxyAddress = events[0].args.portalAddress;

      const depositAmount = ethers.parseEther("5");
      const initialMasterBalance = await ethers.provider.getBalance(newMaster);

      const sendTx = await user1.sendTransaction({
        to: portalProxyAddress,
        value: depositAmount
      });
      await sendTx.wait();

      const finalMasterBalance = await ethers.provider.getBalance(newMaster);
      expect(finalMasterBalance - initialMasterBalance).to.equal(depositAmount);
    });

    it("should restrict updating masterWallet to owner", async function () {
      await expect(factory.connect(user1).setMasterWallet(user1.address))
        .to.be.reverted; // OpenZeppelin OwnableUnauthorizedAccount
    });
  });
});
