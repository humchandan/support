import { verifySignature, signToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const { address, signature, challenge, timestamp } = await request.json();
    
    if (!address || !signature || !challenge || !timestamp) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }
    
    // 1. Verify timestamp is fresh (within 5 minutes)
    const diff = Date.now() - Number(timestamp);
    if (diff < 0 || diff > 300000) {
      return Response.json({ error: 'Challenge expired or invalid' }, { status: 400 });
    }
    
    // 2. Verify challenge matches expected parameters
    const expectedChallenge = `Sign to log into Aries MLM Portal:\nAddress: ${address.toLowerCase()}\nTimestamp: ${timestamp}`;
    if (challenge !== expectedChallenge) {
      return Response.json({ error: 'Invalid challenge message' }, { status: 400 });
    }
    
    // 3. Verify signature
    const isValid = verifySignature(address, signature, challenge);
    if (!isValid) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // 4. Generate JWT token
    const token = signToken(address);
    return Response.json({ token, success: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
