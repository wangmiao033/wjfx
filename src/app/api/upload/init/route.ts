import { handleUpload } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Blob 客户端直传处理
 * 
 * 客户端调用 @vercel/blob/client 的 upload() 时：
 * 1. 先 POST 到此路由获取 client token
 * 2. 用 token 直传文件到 Vercel Blob
 * 3. 上传完成后 Vercel 会回调此路由
 */
export async function POST(request: NextRequest) {
  try {
    // 先解析 body
    const body = await request.json();
    
    // 构造一个新的 request 对象给 handleUpload
    // handleUpload 需要从 body 中判断 action 类型
    const result = await handleUpload({
      request,
      body,
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

        return {
          maximumSizeInBytes: 500 * 1024 * 1024,
          validUntil: Date.now() + 30 * 60 * 1000,
          tokenPayload: JSON.stringify({
            userId,
            expireDays: payload.expireDays || 7,
            password: payload.password || null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 上传完成回调 - 由 Vercel 内部调用
        // 我们在前端上传完成后调用 /api/upload/complete 创建数据库记录
      },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Upload init error:', error?.message || error);
    return NextResponse.json({ error: error?.message || '初始化上传失败' }, { status: 500 });
  }
}
