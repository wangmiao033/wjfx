import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const files = await db.sharedFile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const result = files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      shareCode: f.shareCode,
      expiresAt: f.expiresAt,
      createdAt: f.createdAt,
      downloadCount: f.downloadCount,
      isExpired: new Date() > f.expiresAt,
    }));

    return NextResponse.json({ files: result });
  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json({ error: '获取文件列表失败' }, { status: 500 });
  }
}
