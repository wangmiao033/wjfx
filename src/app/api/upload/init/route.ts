import { NextRequest, NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Vercel Blob 客户端直传处理
 *
 * 该路由有两个职责：
 * 1. 生成客户端上传 token（客户端拿到 token 后直接上传到 Blob，不经过服务器）
 * 2. 上传完成后回调（可选，更新数据库记录）
 */
export async function POST(request: NextRequest) {
  try {
    // 验证登录状态
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();

    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        // 解析客户端传递的元数据
        let payload: any = {};
        try {
          if (clientPayload) payload = JSON.parse(clientPayload);
        } catch {}

        // 文件大小限制：500MB
        return {
          maximumSizeInBytes: 500 * 1024 * 1024,
          validUntil: Date.now() + 30 * 60 * 1000, // 30分钟有效期
          tokenPayload: JSON.stringify({
            userId,
            expireDays: payload.expireDays || 7,
            password: payload.password || null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 上传完成后的回调 —— 更新数据库
        // 注意：这个回调由 Vercel Blob 服务端调用，可能不在本请求上下文中
        // 所以我们不在回调中处理数据库逻辑，而是在前端上传完成后调用 /api/upload/complete
      },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Upload init error:', error?.message || error);
    return NextResponse.json({ error: '初始化上传失败' }, { status: 500 });
  }
}
