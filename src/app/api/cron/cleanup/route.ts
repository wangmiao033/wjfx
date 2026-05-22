import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteFile } from '@/lib/storage';

/**
 * Cron API - 清理过期文件
 * 可通过 Vercel Cron 或外部定时任务调用
 * 需要 Authorization header 或 CRON_SECRET 环境变量验证
 */
export async function GET(request: NextRequest) {
  try {
    // 验证请求来源
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 查找所有过期文件
    const expiredFiles = await db.sharedFile.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
      take: 50, // 每次最多清理50个，避免超时
    });

    if (expiredFiles.length === 0) {
      return NextResponse.json({ message: '没有过期文件', cleaned: 0 });
    }

    let cleaned = 0;
    let errors = 0;

    for (const file of expiredFiles) {
      try {
        // 删除存储中的文件
        await deleteFile(file.filePath);
        // 删除数据库记录
        await db.sharedFile.delete({ where: { id: file.id } });
        cleaned++;
      } catch (err) {
        console.error(`Failed to clean file ${file.id}:`, err);
        // 即使存储删除失败，也删除数据库记录
        try {
          await db.sharedFile.delete({ where: { id: file.id } });
          cleaned++;
        } catch {
          errors++;
        }
      }
    }

    console.log(`Cleanup: ${cleaned} files cleaned, ${errors} errors`);
    return NextResponse.json({
      message: `清理完成`,
      cleaned,
      errors,
      total: expiredFiles.length,
    });
  } catch (error) {
    console.error('Cleanup cron error:', error);
    return NextResponse.json({ error: '清理失败' }, { status: 500 });
  }
}
