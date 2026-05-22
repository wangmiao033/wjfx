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
    if (new Date() > sharedFile.expiresAt) {
      return NextResponse.json({ error: '分享链接已过期' }, { status: 410 });
    }

    // 检查是否有密码保护（预览也需要验证）
    const password = request.nextUrl.searchParams.get('password');
    if (sharedFile.password && sharedFile.password !== password) {
      return NextResponse.json({ error: '需要密码' }, { status: 403 });
    }

    // 本地文件模式
    if (!sharedFile.filePath.startsWith('http://') && !sharedFile.filePath.startsWith('https://')) {
      const { readFile } = await import('fs/promises');
      const path = await import('path');
      const localPath = path.join(process.cwd(), 'uploads', sharedFile.filePath);

      try {
        const buffer = await readFile(localPath);
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': sharedFile.mimeType || 'application/octet-stream',
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(sharedFile.fileName)}`,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch {
        return NextResponse.json({ error: '文件不存在' }, { status: 404 });
      }
    }

    // Vercel Blob 模式 - 流式代理
    const blobResponse = await fetch(sharedFile.filePath, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!blobResponse.ok) {
      return NextResponse.json({ error: '文件获取失败' }, { status: 502 });
    }

    const headers: Record<string, string> = {
      'Content-Type': blobResponse.headers.get('content-type') || sharedFile.mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(sharedFile.fileName)}`,
      'Cache-Control': 'public, max-age=3600',
    };

    const contentLength = blobResponse.headers.get('content-length');
    if (contentLength) headers['Content-Length'] = contentLength;

    return new NextResponse(blobResponse.body, { headers });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: '预览失败' }, { status: 500 });
  }
}
