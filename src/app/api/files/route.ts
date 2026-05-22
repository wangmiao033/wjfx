import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // 必须登录才能查看文件列表
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const files = await db.sharedFile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
      hasPassword: !!f.password,
    }));

    return NextResponse.json({ files: result });
  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json({ error: '获取文件列表失败' }, { status: 500 });
  }
}
