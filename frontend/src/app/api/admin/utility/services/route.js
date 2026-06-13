import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const ADMIN_ADDRESSES = [
  '0x963ebdf2e1f8db8707d05fc75bfeffba1b5bac17'
];

function isAdmin(walletAddress) {
  if (!walletAddress) return false;
  return ADMIN_ADDRESSES.includes(walletAddress.toLowerCase());
}

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { categoryId, name, description, minAmount, maxAmount } = await request.json();
    if (!categoryId || !name || !description) {
      return Response.json({ error: 'Category ID, name, and description are required' }, { status: 400 });
    }

    const service = await prisma.utilityService.create({
      data: {
        categoryId: parseInt(categoryId),
        name,
        description,
        minAmount: parseFloat(minAmount) || 1.0,
        maxAmount: parseFloat(maxAmount) || 1000.0,
        isActive: true
      }
    });

    return Response.json({ success: true, service });
  } catch (err) {
    console.error("Failed to create utility service:", err);
    return Response.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

export async function PUT(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, name, description, minAmount, maxAmount, isActive } = await request.json();
    if (!id || !name || !description) {
      return Response.json({ error: 'ID, name, and description are required' }, { status: 400 });
    }

    const service = await prisma.utilityService.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        minAmount: parseFloat(minAmount),
        maxAmount: parseFloat(maxAmount),
        isActive: isActive ?? true
      }
    });

    return Response.json({ success: true, service });
  } catch (err) {
    console.error("Failed to update utility service:", err);
    return Response.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id'));

    if (!id) {
      return Response.json({ error: 'Service ID is required' }, { status: 400 });
    }

    await prisma.utilityService.delete({
      where: { id }
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Failed to delete utility service:", err);
    return Response.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
