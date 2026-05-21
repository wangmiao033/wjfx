import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Redirect to Vercel Blob URL for direct download
    // Add download=1 parameter to force browser download instead of inline display
    const downloadUrl = sharedFile.blobUrl.includes('?')
      ? `${sharedFile.blobUrl}&download=1`
      : `${sharedFile.blobUrl}?download=1`;

    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
