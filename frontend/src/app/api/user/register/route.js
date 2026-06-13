import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { ethers } from 'ethers';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { name, mobile, referrerAddress } = await request.json();
    
    if (!name || !mobile) {
      return Response.json({ error: 'Name and mobile number are required' }, { status: 400 });
    }
    
    // Check if user already registered
    const existingUser = await prisma.user.findUnique({
      where: { walletAddress }
    });
    if (existingUser) {
      return Response.json({ error: 'User is already registered' }, { status: 400 });
    }
    
    let sponsor = referrerAddress ? referrerAddress.toLowerCase().trim() : '';
    if (sponsor) {
      if (!ethers.isAddress(sponsor)) {
        return Response.json({ error: 'Invalid referrer wallet address' }, { status: 400 });
      }
      if (sponsor === walletAddress.toLowerCase()) {
        return Response.json({ error: 'You cannot refer yourself' }, { status: 400 });
      }
      
      // Check if referrer is a registered user
      const referrerUser = await prisma.user.findUnique({
        where: { walletAddress: sponsor }
      });
      
      // Fallback: If sponsor does not exist, we default them or create a basic profile
      if (!referrerUser) {
        await prisma.user.create({
          data: {
            walletAddress: sponsor,
            name: 'Sponsor Partner',
            mobile: '+1 (555) 000-1111',
            sponsorAddress: '0x963ebdf2e1f8db8707d05fc75bfeffba1b5bac17' // Default custodian
          }
        });
      }
    } else {
      sponsor = '0x963ebdf2e1f8db8707d05fc75bfeffba1b5bac17'; // Default custodian
    }
    
    // Create new user in DB
    const newUser = await prisma.user.create({
      data: {
        walletAddress: walletAddress.toLowerCase(),
        name,
        mobile,
        sponsorAddress: sponsor
      }
    });
    
    return Response.json({ success: true, user: newUser });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Registration failed' }, { status: 500 });
  }
}
