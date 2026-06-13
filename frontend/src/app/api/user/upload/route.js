import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { verifyToken } from '@/lib/auth';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.formData();
    const file = data.get('file');
    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure upload folder exists under public/uploads
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Clean name to prevent path traversal
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filename = `${Date.now()}_${safeName}`;
    const filePath = join(uploadDir, filename);

    await writeFile(filePath, buffer);

    return Response.json({
      success: true,
      url: `/uploads/${filename}`
    });
  } catch (err) {
    console.error('File upload failed:', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}
