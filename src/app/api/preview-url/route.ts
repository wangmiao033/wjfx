import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 生成 Vercel Blob 临时签名预览 URL
 * 用于图片/PDF/视频/音频的在线预览，客户端直接从 Blob 加载
 * 签名 URL 有效期 300 秒（预览需要更长，因为媒体可能需要多次请求）
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const password = request.nextUrl.searchParams.get('password');

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
    if (new Date() > sharedFile.expiresAt) {
      return NextResponse.json({ error: '分享链接已过期' }, { status: 410 });
    }

    // 检查密码
    if (sharedFile.password && sharedFile.password !== password) {
      return NextResponse.json({ error: '需要密码' }, { status: 403 });
    }

    // 本地文件模式 - 返回本地预览 API 路径
    if (!sharedFile.filePath.startsWith('http://') && !sharedFile.filePath.startsWith('https://')) {
      const passwordParam = sharedFile.password && password ? `&password=${encodeURIComponent(password)}` : '';
      return NextResponse.json({
        previewUrl: `/api/preview?code=${code}${passwordParam}`,
        fileName: sharedFile.fileName,
        mimeType: sharedFile.mimeType,
        isLocal: true,
      });
    }

    // Vercel Blob 模式 - 生成临时签名 URL
    const { getDownloadUrl } = await import('@vercel/blob');
    const { url } = await getDownloadUrl(sharedFile.filePath, {
      expiresInSeconds: 300, // 5分钟有效期（预览需要更长时间）
    });

    return NextResponse.json({
      previewUrl: url,
      fileName: sharedFile.fileName,
      mimeType: sharedFile.mimeType,
      isLocal: false,
    });
  } catch (error: any) {
    console.error('Preview URL error:', error?.message || error);
    return NextResponse.json({ error: '获取预览链接失败' }, { status: 500 });
  }
}
