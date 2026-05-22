import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 生成 Vercel Blob 临时签名下载 URL
 * 
 * 签名 URL 会自动设置正确的 Content-Disposition: attachment 头
 * 浏览器直接访问该 URL 即可下载文件，无需 JS 中转
 * 
 * 有效期：60 秒（足够浏览器发起下载）
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
    if (sharedFile.password) {
      if (!password || password !== sharedFile.password) {
        return NextResponse.json({ error: '密码错误' }, { status: 403 });
      }
    }

    // 增加下载计数
    await db.sharedFile.update({
      where: { id: sharedFile.id },
      data: { downloadCount: { increment: 1 } },
    });

    // 本地文件模式 - 返回本地下载 API 路径
    if (!sharedFile.filePath.startsWith('http://') && !sharedFile.filePath.startsWith('https://')) {
      const passwordParam = sharedFile.password && password ? `&password=${encodeURIComponent(password)}` : '';
      return NextResponse.json({
        downloadUrl: `/api/download?code=${code}${passwordParam}`,
        fileName: sharedFile.fileName,
        fileSize: sharedFile.fileSize,
        isLocal: true,
      });
    }

    // Vercel Blob 模式 - 生成临时签名 URL
    const { getDownloadUrl } = await import('@vercel/blob');
    const { url } = await getDownloadUrl(sharedFile.filePath, {
      expiresInSeconds: 120, // 2分钟有效期（浏览器需要时间发起连接）
    });

    console.log(`[download-url] Generated signed URL for ${sharedFile.fileName}`);

    return NextResponse.json({
      downloadUrl: url,
      fileName: sharedFile.fileName,
      fileSize: sharedFile.fileSize,
      isLocal: false,
    });
  } catch (error: any) {
    console.error('[download-url] Error:', error?.message || error);
    return NextResponse.json({ error: '获取下载链接失败' }, { status: 500 });
  }
}
