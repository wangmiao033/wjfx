import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { deleteFile } from '@/lib/storage';

export async function DELETE(request: NextRequest) {
  try {
    // 必须登录
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少文件ID' }, { status: 400 });
    }

    const sharedFile = await db.sharedFile.findUnique({ where: { id } });

    if (!sharedFile) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 只能删除自己的文件
    if (sharedFile.userId !== userId) {
      return NextResponse.json({ error: '无权删除此文件' }, { status: 403 });
    }

    // 删除存储中的文件
    await deleteFile(sharedFile.filePath);

    // 删除数据库记录
    await db.sharedFile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
