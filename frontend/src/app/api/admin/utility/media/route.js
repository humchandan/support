import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const ADMIN_ADDRESSES = [
  '0xd01c1bfc96e22a9470c186e69e0a97e18eff23e6'
];

function isAdmin(walletAddress) {
  if (!walletAddress) return false;
  return ADMIN_ADDRESSES.includes(walletAddress.toLowerCase());
}

export async function GET(request) {
  try {
    const media = await prisma.eventMedia.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return Response.json({ success: true, media });
  } catch (err) {
    console.error("Failed to load event media:", err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, url, title, caption } = body;

    if (!type || !url || !title) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newMedia = await prisma.eventMedia.create({
      data: {
        type,
        url,
        title,
        caption: caption || ''
      }
    });

    return Response.json({ success: true, media: newMedia });
  } catch (err) {
    console.error("Failed to create event media:", err);
    return Response.json({ error: 'Failed to create media entry' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Missing media ID' }, { status: 400 });
    }

    await prisma.eventMedia.delete({
      where: { id: parseInt(id) }
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Failed to delete event media:", err);
    return Response.json({ error: 'Failed to delete media entry' }, { status: 500 });
  }
}
