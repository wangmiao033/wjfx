import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Vercel Blob 模式 - 生成签名 URL 并重定向（不再代理，避免慢速和大小限制）
    if (sharedFile.filePath.startsWith('http://') || sharedFile.filePath.startsWith('https://')) {
      try {
        const { getDownloadUrl } = await import('@vercel/blob');
        const { url } = await getDownloadUrl(sharedFile.filePath, {
          expiresInSeconds: 120, // 2分钟有效期
        });

        console.log(`[download] Redirecting to signed URL for ${sharedFile.fileName}`);

        // 302 重定向到签名 URL，让浏览器直接从 Blob 下载
        // 签名 URL 自带 Content-Disposition: attachment 头
        return NextResponse.redirect(url);
      } catch (blobError: any) {
        console.error('[download] Signed URL failed, trying proxy:', blobError?.message);
        // 签名 URL 失败时回退到代理模式（仅适用于小文件）
        const blobResponse = await fetch(sharedFile.filePath, {
          headers: {
            Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
          },
        });

        if (!blobResponse.ok) {
          return NextResponse.json({ error: '文件下载失败' }, { status: 502 });
        }

        const headers: Record<string, string> = {
          'Content-Type': blobResponse.headers.get('content-type') || sharedFile.mimeType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(sharedFile.fileName)}`,
        };

        const contentLength = blobResponse.headers.get('content-length');
        if (contentLength) headers['Content-Length'] = contentLength;

        return new NextResponse(blobResponse.body, { headers });
      }
    }

    // 本地文件模式（仅本地开发环境可用）
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    const localPath = path.join(process.cwd(), 'uploads', sharedFile.filePath);

    try {
      const buffer = await readFile(localPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': sharedFile.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(sharedFile.fileName)}`,
          'Content-Length': sharedFile.fileSize.toString(),
        },
      });
    } catch {
      // 本地文件不存在（在 Vercel 上这是预期的，因为本地文件不会持久化）
      console.warn(`[download] Local file not found: ${sharedFile.filePath}`);
      return NextResponse.json({
        error: '文件暂不可用，可能需要重新上传',
        hint: '此文件可能是在系统升级前上传的，存储路径已变更。请联系上传者重新分享。',
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
