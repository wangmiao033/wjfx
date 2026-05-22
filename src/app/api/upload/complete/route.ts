import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * 上传完成后的数据库记录创建
 * 客户端直传 Blob 完成后调用此接口，在数据库中创建文件分享记录
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { blobUrl, fileName, fileSize, mimeType, shareCode, expireDays, password } = body;

    if (!blobUrl || !fileName || !fileSize || !shareCode) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查分享码是否已存在（极低概率）
    let code = shareCode;
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.sharedFile.findUnique({ where: { shareCode: code } });
      if (!existing) break;
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      attempts++;
    }

    // 计算过期时间
    const days = parseInt(expireDays) || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // 保存到数据库
    const sharedFile = await db.sharedFile.create({
      data: {
        fileName,
        fileSize,
        filePath: blobUrl,
        mimeType: mimeType || 'application/octet-stream',
        shareCode: code,
        password: password || null,
        expiresAt,
        userId,
      },
    });

    return NextResponse.json({
      file: {
        id: sharedFile.id,
        fileName: sharedFile.fileName,
        fileSize: sharedFile.fileSize,
        shareCode: sharedFile.shareCode,
        expiresAt: sharedFile.expiresAt,
        createdAt: sharedFile.createdAt,
        hasPassword: !!sharedFile.password,
      },
    });
  } catch (error: any) {
    console.error('Upload complete error:', error?.message || error);
    return NextResponse.json({ error: '保存文件记录失败' }, { status: 500 });
  }
}
