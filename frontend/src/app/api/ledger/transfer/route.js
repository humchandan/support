import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { ethers } from 'ethers';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { recipient, amount } = await request.json();
    const parsedAmount = parseFloat(amount) || 0;
    
    if (!recipient || parsedAmount <= 0) {
      return Response.json({ error: 'Recipient address and positive transfer amount are required' }, { status: 400 });
    }
    
    if (!ethers.isAddress(recipient)) {
      return Response.json({ error: 'Invalid recipient wallet address' }, { status: 400 });
    }
    
    if (recipient.toLowerCase() === walletAddress) {
      return Response.json({ error: 'You cannot transfer credit to yourself' }, { status: 400 });
    }
    
    // 1. Verify recipient exists and has a registered utility wallet/proxy
    const recipientUser = await prisma.user.findFirst({
      where: {
        OR: [
          { walletAddress: recipient.toLowerCase() },
          { proxyAddress: recipient.toLowerCase() }
        ]
      }
    });
    
    if (!recipientUser || !recipientUser.proxyAddress) {
      return Response.json({
        error: 'External wallet withdrawal is not allowed. Recipients must have a registered utility portal account.'
      }, { status: 400 });
    }
    
    // 2. Calculate sender balance
    const senderEntries = await prisma.ledgerEntry.findMany({
      where: { userAddress: walletAddress }
    });
    
    let senderBalance = 0;
    senderEntries.forEach(entry => {
      const amt = Number(entry.amount);
      const net = Number(entry.netAmount);
      if (entry.type === 'DEPOSIT' || entry.type === 'TRANSFER_IN' || entry.type === 'CLAIM_DIRECT') {
        senderBalance += net;
      } else {
        senderBalance -= amt;
      }
    });
    
    if (senderBalance < parsedAmount) {
      return Response.json({ error: `Insufficient utility portal balance. Available: ${senderBalance.toFixed(2)} ARES` }, { status: 400 });
    }
    
    // 3. Process transfer inside a database transaction
    const fee = parsedAmount * 0.05;
    const net = parsedAmount - fee;
    
    await prisma.$transaction(async (tx) => {
      // Record Sender Debit (Transfer Out)
      await tx.ledgerEntry.create({
        data: {
          userAddress: walletAddress,
          type: 'TRANSFER_OUT',
          amount: parsedAmount,
          netAmount: parsedAmount,
          fee: 0,
          description: `Transfer Out to ${recipientUser.name} (${recipientUser.walletAddress.substring(0, 6)}...)`,
          timestamp: new Date()
        }
      });
      
      // Record Recipient Credit (Transfer In)
      await tx.ledgerEntry.create({
        data: {
          userAddress: recipientUser.walletAddress,
          type: 'TRANSFER_IN',
          amount: net,
          netAmount: net,
          fee,
          description: `Transfer In from ${walletAddress.substring(0, 6)}...`,
          timestamp: new Date()
        }
      });
    });
    
    return Response.json({ success: true, netAmount: net, fee });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Transfer failed' }, { status: 500 });
  }
}
