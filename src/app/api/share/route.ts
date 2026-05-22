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

    // 检查是否过期
    const isExpired = new Date() > sharedFile.expiresAt;

    return NextResponse.json({
      file: {
        id: sharedFile.id,
        fileName: sharedFile.fileName,
        fileSize: sharedFile.fileSize,
        shareCode: sharedFile.shareCode,
        expiresAt: sharedFile.expiresAt,
        createdAt: sharedFile.createdAt,
        downloadCount: sharedFile.downloadCount,
        isExpired,
        hasPassword: !!sharedFile.password,
      },
    });
  } catch (error) {
    console.error('Share info error:', error);
    return NextResponse.json({ error: '获取分享信息失败' }, { status: 500 });
  }
}
