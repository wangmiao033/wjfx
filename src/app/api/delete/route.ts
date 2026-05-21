import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import path from 'path';

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

    // Delete file from disk
    try {
      const filePath = path.join(process.cwd(), 'uploads', sharedFile.filePath);
      await unlink(filePath);
    } catch {
      // File may already be deleted, ignore error
    }

    // Delete from database
    await db.sharedFile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
