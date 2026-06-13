import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { accruedAmount } = await request.json();
    const accrued = parseFloat(accruedAmount) || 0;

    if (accrued < 100.0) {
      return Response.json({ error: 'You must have at least 100 ARES accrued to withdraw to MetaMask.' }, { status: 400 });
    }

    // 1. Fetch user profile to get proxyAddress
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user || !user.proxyAddress) {
      return Response.json({ error: 'Please create a utility wallet address first.' }, { status: 400 });
    }

    // 2. Load Portal Contract address from public JSON artifact
    const portalJsonPath = path.join(process.cwd(), 'public/contracts/AriesSupportPortal.json');
    const portalJson = JSON.parse(fs.readFileSync(portalJsonPath, 'utf8'));
    const portalAddress = portalJson.address;

    // 3. Fetch total deposited and claimed on-chain or fallback to DB
    let totalDeposited = 0;
    let totalClaimed = 0;
    try {
      const RPC_URL = process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'http://127.0.0.1:8545';
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const portalContract = new ethers.Contract(portalAddress, portalJson.abi, provider);
      const plan = await portalContract.userPlans(walletAddress);
      totalDeposited = Number(ethers.formatEther(plan.totalDeposited));
      totalClaimed = Number(ethers.formatEther(plan.totalClaimed));
    } catch (contractErr) {
      console.error("Failed to query on-chain plans, falling back to DB:", contractErr);
      const plans = await prisma.stakingPlan.findMany({
        where: { userAddress: walletAddress }
      });
      totalDeposited = plans.reduce((acc, p) => acc + Number(p.amount), 0);

      const claimHistory = await prisma.claimHistory.findMany({
        where: { userAddress: walletAddress }
      });
      totalClaimed = claimHistory.reduce((acc, c) => acc + Number(c.grossAmount), 0);
    }

    if (totalDeposited <= 0) {
      return Response.json({ error: 'Cannot claim rewards without active validation plans on-chain. Please purchase a plan first.' }, { status: 400 });
    }

    const maxLimit = totalDeposited * 2;

    if (totalClaimed >= maxLimit) {
      return Response.json({ error: 'Lifetime payout limit reached! Please purchase a top-up plan.' }, { status: 400 });
    }

    // 4. Calculate claimable amount capped at remaining limit
    let claimable = accrued;
    if (totalClaimed + accrued > maxLimit) {
      claimable = maxLimit - totalClaimed;
    }

    if (claimable <= 0) {
      return Response.json({ error: 'No remaining capacity under current payout cap.' }, { status: 400 });
    }

    // Convert values to Wei BigInts for contract verification
    const totalClaimedWei = ethers.parseEther(totalClaimed.toString());
    const claimableWei = ethers.parseEther(claimable.toString());
    const newTotalEligibleWei = totalClaimedWei + claimableWei;

    // 6. Generate Signature
    const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minute deadline
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerPrivateKey) {
      return Response.json({ error: 'Server configuration error: Signer key missing.' }, { status: 500 });
    }

    const serverWallet = new ethers.Wallet(signerPrivateKey);
    const hash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "uint256", "address"],
      [walletAddress.toLowerCase(), user.proxyAddress.toLowerCase(), newTotalEligibleWei, deadline, portalAddress]
    );

    const signature = await serverWallet.signMessage(ethers.getBytes(hash));

    return Response.json({
      success: true,
      signature,
      newTotalEligible: newTotalEligibleWei.toString(),
      deadline,
      claimableAmount: claimable,
      portalAddress
    });

  } catch (err) {
    console.error("Signature generation API error:", err);
    return Response.json({ error: 'Failed to generate claim signature' }, { status: 500 });
  }
}
