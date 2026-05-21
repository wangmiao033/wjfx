import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFile, stat } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: '缺少分享码' }, { status: 400 });
    }

    const sharedFile = await db.sharedFile.findUnique({
      where: { shareCode: code },
    });

    if (!sharedFile) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // Check if expired
    if (new Date() > sharedFile.expiresAt) {
      return NextResponse.json({ error: '分享链接已过期' }, { status: 410 });
    }

    // Increment download count
    await db.sharedFile.update({
      where: { id: sharedFile.id },
      data: { downloadCount: { increment: 1 } },
    });

    // Read file
    const filePath = path.join(process.cwd(), 'uploads', sharedFile.filePath);
    const fileBuffer = await readFile(filePath);

    // Encode filename for Content-Disposition (support Chinese filenames)
    const encodedFileName = encodeURIComponent(sharedFile.fileName);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': sharedFile.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': sharedFile.fileSize.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
