import { handleUpload } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Vercel Blob 客户端直传处理
 *
 * 客户端调用 @vercel/blob/client 的 upload() 时：
 * 1. 先 POST 到此路由获取 client token
 * 2. 用 token 直传文件到 Vercel Blob（不经过服务器，无大小限制）
 * 3. 上传完成后 Vercel 会回调此路由（可选）
 *
 * ⚠️ 重要：getServerSession 必须在 handleUpload 回调外部调用
 * 因为 Next.js App Router 的 async local storage 在回调内无法正确传播
 */
export async function POST(request: NextRequest) {
  try {
    // 【关键修复】在 handleUpload 外部获取 session
    // NextAuth v4 的 getServerSession 依赖 async local storage (headers/cookies)
    // 在 handleUpload 的回调函数内部，async context 丢失，导致 session 为 null
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.warn('[upload/init] Unauthorized: no session found');
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 解析请求体，传递给 handleUpload
    const body = await request.json();

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        // session 已在外部获取，这里直接使用
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
      { status: 500 }
    );
  }
}
