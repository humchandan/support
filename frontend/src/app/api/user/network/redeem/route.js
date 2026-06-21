import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { ethers } from 'ethers';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userAddr = walletAddress.toLowerCase();

    // 1. Fetch unclaimed network earnings
    const unclaimed = await prisma.networkEarning.findMany({
      where: {
        userAddress: userAddr,
        isClaimed: false
      }
    });

    if (unclaimed.length === 0) {
      return Response.json({ error: 'No available network matching earnings to redeem.' }, { status: 400 });
    }

    const totalRedeemable = unclaimed.reduce((acc, curr) => acc + Number(curr.amount), 0);

    if (totalRedeemable <= 0) {
      return Response.json({ error: 'Redeemable balance must be greater than zero.' }, { status: 400 });
    }

    // 2. Fetch server private key (default to signer key or deployer key fallback)
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY || '7f5d4d81e5a51efc4dab751d7e18889dd550d687eae7444a8bc1b37430d8565d';
    const rpcUrl = process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'https://rpc.arieschain.org';
    
    // 3. Initiate contract wallet provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const serverWallet = new ethers.Wallet(signerPrivateKey, provider);

    // 4. Send ARES directly to user wallet on-chain
    console.log(`[Redeem] Sending ${totalRedeemable} ARES from server wallet ${serverWallet.address} to ${walletAddress}...`);
    
    let tx;
    try {
      tx = await serverWallet.sendTransaction({
        to: walletAddress,
        value: ethers.parseEther(totalRedeemable.toString()),
        gasPrice: ethers.parseUnits("1.5", "gwei") // Ensure validator minimum is met
      });
    } catch (txErr) {
      console.error('On-chain token transfer failed:', txErr);
      return Response.json({ error: 'Blockchain transaction rejected or server wallet out of funds. Contact admin.' }, { status: 500 });
    }

    const receipt = await tx.wait();

    // 5. Update database inside transaction to mark as claimed
    const unclaimedIds = unclaimed.map(u => u.id);
    await prisma.$transaction(async (dbTx) => {
      await dbTx.networkEarning.updateMany({
        where: { id: { in: unclaimedIds } },
        data: {
          isClaimed: true,
          txHash: receipt.hash || tx.hash
        }
      });

      // Record a LedgerEntry for network redemption for audit trail
      await dbTx.ledgerEntry.create({
        data: {
          userAddress: userAddr,
          type: 'NETWORK_REDEEM',
          amount: totalRedeemable,
          netAmount: totalRedeemable,
          fee: 0,
          description: `Redeemed network matching earnings of ${totalRedeemable.toFixed(2)} ARES directly to MetaMask wallet.`,
          txHash: receipt.hash || tx.hash,
          timestamp: new Date()
        }
      });
    });

    return Response.json({
      success: true,
      amount: totalRedeemable,
      txHash: receipt.hash || tx.hash
    });
  } catch (err) {
    console.error('Failed to redeem network earnings:', err);
    return Response.json({ error: err.message || 'Redemption failed' }, { status: 500 });
  }
}
