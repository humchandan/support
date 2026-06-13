import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const ADMIN_ADDRESSES = [
  '0x963ebdf2e1f8db8707d05fc75bfeffba1b5bac17'
];

function isAdmin(walletAddress) {
  if (!walletAddress) return false;
  return ADMIN_ADDRESSES.includes(walletAddress.toLowerCase());
}

export async function GET(request) {
  try {
    const walletAddress = verifyToken(request);
    if (!walletAddress) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const categories = await prisma.utilityCategory.findMany({
      include: { services: true },
      orderBy: { id: 'asc' }
    });
    return Response.json({ categories });
  } catch (err) {
    console.error("Failed to load utility categories:", err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, icon } = await request.json();
    if (!name || !icon) {
      return Response.json({ error: 'Name and icon are required' }, { status: 400 });
    }

    const category = await prisma.utilityCategory.create({
      data: { name, icon, isActive: true }
    });

    return Response.json({ success: true, category });
  } catch (err) {
    console.error("Failed to create utility category:", err);
    return Response.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

export async function PUT(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, name, icon, isActive } = await request.json();
    if (!id || !name || !icon) {
      return Response.json({ error: 'ID, name, and icon are required' }, { status: 400 });
    }

    const category = await prisma.utilityCategory.update({
      where: { id: parseInt(id) },
      data: { name, icon, isActive: isActive ?? true }
    });

    return Response.json({ success: true, category });
  } catch (err) {
    console.error("Failed to update utility category:", err);
    return Response.json({ error: 'Failed to update category' }, { status: 500 });
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
      return Response.json({ error: 'Category ID is required' }, { status: 400 });
    }

    await prisma.utilityCategory.delete({
      where: { id }
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Failed to delete utility category:", err);
    return Response.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
