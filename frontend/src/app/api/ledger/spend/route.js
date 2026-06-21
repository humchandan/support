import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { serviceId, amount, details } = await request.json();
    const spendAmount = parseFloat(amount) || 0;
    const sId = parseInt(serviceId) || 0;

    if (spendAmount <= 0) {
      return Response.json({ error: 'Invalid spend amount' }, { status: 400 });
    }

    // 1. Fetch service details
    const service = await prisma.utilityService.findUnique({
      where: { id: sId },
      include: { category: true }
    });

    if (!service || !service.isActive || !service.category.isActive) {
      return Response.json({ error: 'Selected utility service is currently unavailable' }, { status: 404 });
    }

    if (spendAmount < Number(service.minAmount) || spendAmount > Number(service.maxAmount)) {
      return Response.json({
        error: `Spend amount must be between ${Number(service.minAmount)} and ${Number(service.maxAmount)} ARES`
      }, { status: 400 });
    }

    // 2. Calculate user balance dynamically
    const entries = await prisma.ledgerEntry.findMany({
      where: { userAddress: walletAddress }
    });

    let currentBalance = 0;
    entries.forEach(entry => {
      const amt = Number(entry.amount);
      const net = Number(entry.netAmount);
      
      if (
        entry.type === 'DEPOSIT' || 
        entry.type === 'TRANSFER_IN' || 
        entry.type === 'CLAIM_DIRECT' ||
        entry.type === 'CLAIM_METAMASK_SPLIT' ||
        entry.type === 'NETWORK_REDEEM' ||
        entry.type === 'SPEND_REFUND'
      ) {
        currentBalance += net;
      } else if (
        entry.type === 'SPEND' ||
        entry.type === 'SPEND_PENDING' ||
        entry.type === 'TRANSFER_OUT'
      ) {
        currentBalance -= amt;
      }
    });

    if (currentBalance < spendAmount) {
      return Response.json({ error: 'Insufficient utility credit balance' }, { status: 400 });
    }

    // 3. Create Utility Request and record PENDING debit inside a db transaction
    const detailsString = typeof details === 'string' ? details : JSON.stringify(details || {});
    
    // Format a nice details summary description
    let summaryDesc = '';
    if (details && typeof details === 'object') {
      const parts = [];
      if (details.phoneNo) parts.push(`Phone: ${details.phoneNo}`);
      if (details.operator) parts.push(`Operator: ${details.operator}`);
      if (details.billId) parts.push(`Bill ID: ${details.billId}`);
      if (details.billProvider) parts.push(`Provider: ${details.billProvider}`);
      if (details.internetAcc) parts.push(`Acct: ${details.internetAcc}`);
      if (details.internetIsp) parts.push(`ISP: ${details.internetIsp}`);
      if (details.voucherBrand) parts.push(`Brand: ${details.voucherBrand}`);
      if (details.recipientEmail) parts.push(`Email: ${details.recipientEmail}`);
      summaryDesc = parts.join(', ');
    }
    if (!summaryDesc) {
      summaryDesc = detailsString.substring(0, 50);
    }

    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.utilityRequest.create({
        data: {
          userAddress: walletAddress,
          serviceId: sId,
          serviceName: service.name,
          categoryName: service.category.name,
          details: detailsString,
          amount: spendAmount,
          status: 'PENDING'
        }
      });

      const entry = await tx.ledgerEntry.create({
        data: {
          userAddress: walletAddress,
          type: 'SPEND_PENDING',
          amount: spendAmount,
          netAmount: spendAmount,
          fee: 0,
          description: `Pending: ${service.name} (${summaryDesc}) - Req #${req.id}`,
          timestamp: new Date()
        }
      });

      return { req, entry };
    });

    return Response.json({
      success: true,
      newBalance: Math.max(0, currentBalance - spendAmount),
      request: {
        id: result.req.id,
        serviceName: service.name,
        categoryName: service.category.name,
        amount: Number(result.req.amount),
        status: result.req.status,
        timestamp: result.req.timestamp
      }
    });
  } catch (err) {
    console.error("Failed to process utility spend request:", err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
