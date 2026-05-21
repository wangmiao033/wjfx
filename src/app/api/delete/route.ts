import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteFile } from '@/lib/storage';

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少文件ID' }, { status: 400 });
    }

    const sharedFile = await db.sharedFile.findUnique({ where: { id } });

    if (!sharedFile) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // Delete file from storage (auto-detects local or Vercel Blob)
    await deleteFile(sharedFile.filePath);

    // Delete from database
    await db.sharedFile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
