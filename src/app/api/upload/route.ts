import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const expireDays = parseInt(formData.get('expireDays') as string) || 14;

    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    // Max file size: 500MB
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '文件大小不能超过 500MB' }, { status: 400 });
    }

    // Generate unique share code
    const shareCode = randomBytes(6).toString('base64url');

    // Generate unique file name to avoid conflicts
    const ext = path.extname(file.name);
    const uniqueName = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, uniqueName);

    // Ensure uploads directory exists
    await mkdir(uploadDir, { recursive: true });

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expireDays);

    // Save to database
    const sharedFile = await db.sharedFile.create({
      data: {
        fileName: file.name,
        fileSize: file.size,
        filePath: uniqueName,
        mimeType: file.type || 'application/octet-stream',
        shareCode,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: sharedFile.id,
        fileName: sharedFile.fileName,
        fileSize: sharedFile.fileSize,
        shareCode: sharedFile.shareCode,
        expiresAt: sharedFile.expiresAt,
        createdAt: sharedFile.createdAt,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 });
  }
}
