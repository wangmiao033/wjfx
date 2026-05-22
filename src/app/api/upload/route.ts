import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { nanoid } from 'nanoid';

// 使用 cuid 风格的短分享码
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    // 验证登录状态
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const expireDays = parseInt(formData.get('expireDays') as string) || 7;
    const password = formData.get('password') as string | null;

    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    // 文件大小限制：500MB
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '文件大小不能超过 500MB' }, { status: 400 });
    }

    // 生成唯一分享码
    let shareCode = generateShareCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.sharedFile.findUnique({ where: { shareCode } });
      if (!existing) break;
      shareCode = generateShareCode();
      attempts++;
    }

    // 上传文件到存储
    const storageResult = await uploadFile(file, shareCode);

    // 计算过期时间
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);

    // 保存到数据库
    const sharedFile = await db.sharedFile.create({
      data: {
        fileName: file.name,
        fileSize: file.size,
        filePath: storageResult.filePath,
        mimeType: file.type || 'application/octet-stream',
        shareCode,
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
    console.error('Upload error:', error?.message || error);
    return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 });
  }
}
