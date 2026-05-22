import { handleUpload } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Blob 客户端直传处理
 *
 * 客户端调用 @vercel/blob/client 的 upload() 时：
 * 1. 先 POST 到此路由获取 client token
 * 2. 用 token 直传文件到 Vercel Blob（不经过服务器，无大小限制）
 * 3. 上传完成后 Vercel 会回调此路由（可选）
 */
export async function POST(request: NextRequest) {
  try {
    // handleUpload 需要原始请求和解析后的 body
    // 注意：request.json() 只能调用一次，之后 body 被消费
    // handleUpload 不会再次读取 request body（因为提供了 body 参数）
    const body = await request.json();

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        // 验证用户登录
        const { getServerSession } = await import('next-auth');
        const { authOptions } = await import('@/lib/auth');
        const session = await getServerSession(authOptions);

        if (!session?.user) {
          throw new Error('请先登录');
        }

        const userId = (session.user as any).id;

        // 解析客户端元数据
        let payload: any = {};
        try {
          if (clientPayload) payload = JSON.parse(clientPayload);
        } catch {}

        console.log(`[upload/init] Generating token for ${pathname}, multipart=${multipart}, userId=${userId}`);

        return {
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
          validUntil: Date.now() + 60 * 60 * 1000, // 60分钟有效期（大文件上传需要更长时间）
          tokenPayload: JSON.stringify({
            userId,
            expireDays: payload.expireDays || 7,
            password: payload.password || null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 上传完成回调 - 由 Vercel Blob 内部服务调用
        // 我们在前端上传完成后调用 /api/upload/complete 创建数据库记录
        console.log(`[upload/init] Upload completed: ${blob.url}`);
      },
    });

    console.log(`[upload/init] Result type: ${result.type}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[upload/init] Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || '初始化上传失败' },
      { status: error?.message === '请先登录' ? 401 : 500 }
    );
  }
}
