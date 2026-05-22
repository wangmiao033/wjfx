/**
 * 文件存储工具 - 环境自适应
 *
 * 本地开发：使用本地文件系统 (uploads/ 目录)
 * Vercel 部署：使用 Vercel Blob 对象存储（私有模式）
 *
 * 自动检测：如果存在 BLOB_READ_WRITE_TOKEN 环境变量，则使用 Vercel Blob
 */

import { randomBytes } from 'crypto';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';

// 检测是否在 Vercel 环境且配置了 Blob
function isVercelBlob(): boolean {
  return typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' && process.env.BLOB_READ_WRITE_TOKEN.length > 0;
}

export interface StorageResult {
  filePath: string; // 本地模式：唯一文件名; Vercel模式：Blob URL
}

/**
 * 上传文件到存储
 */
export async function uploadFile(file: File, shareCode: string): Promise<StorageResult> {
  if (isVercelBlob()) {
    return await uploadToVercelBlob(file, shareCode);
  }
  return await uploadToLocal(file);
}

/**
 * 删除文件
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    // Vercel Blob → 通过 API 删除
    try {
      const { del } = await import('@vercel/blob');
      await del(filePath);
    } catch {
      // Blob 可能已被删除，忽略错误
    }
    return;
  }

  // 本地文件 → 从磁盘删除
  try {
    const localPath = path.join(process.cwd(), 'uploads', filePath);
    await unlink(localPath);
  } catch {
    // 文件可能已被删除，忽略错误
  }
}

// ==================== 本地文件存储 ====================

async function uploadToLocal(file: File): Promise<StorageResult> {
  const ext = path.extname(file.name);
  const uniqueName = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  const uploadDir = path.join(process.cwd(), 'uploads');
  const localPath = path.join(uploadDir, uniqueName);

  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(localPath, buffer);

  return { filePath: uniqueName };
}

// ==================== Vercel Blob 存储（私有模式） ====================

async function uploadToVercelBlob(file: File, shareCode: string): Promise<StorageResult> {
  const { put } = await import('@vercel/blob');
  const blob = await put(`share/${shareCode}/${file.name}`, file, {
    access: 'private', // 私有模式 - 必须通过服务端代理访问
  });
  return { filePath: blob.url };
}
