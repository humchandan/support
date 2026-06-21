import { ethers } from 'ethers';
import { verifyToken } from '@/lib/auth';

const ADMIN_ADDRESSES = [
  '0xd01c1bfc96e22a9470c186e69e0a97e18eff23e6'
];

function isAdmin(walletAddress) {
  if (!walletAddress) return false;
  return ADMIN_ADDRESSES.includes(walletAddress.toLowerCase());
}

export async function GET(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const signerKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerKey) {
      return Response.json({ error: 'Signer key is not configured in backend .env' }, { status: 500 });
    }

    const wallet = new ethers.Wallet(signerKey);
    const derivedSignerAddress = wallet.address;

    return Response.json({
      success: true,
      derivedSignerAddress
    });
  } catch (err) {
    console.error("Failed to verify signer:", err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
