const MAX_FILE_SIZE = 500 * 1024 * 1024;

export function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export interface UploadOptions {
  expireDays: string;
  password?: string | null;
  onProgress?: (progress: number) => void;
}

export async function uploadFile(
  file: File,
  options: UploadOptions,
): Promise<{ shareCode: string; fileName: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('文件超过 500MB');
  }

  const { expireDays, password, onProgress } = options;
  const enablePassword = !!password?.trim();

  try {
    const { upload } = await import('@vercel/blob/client');
    const shareCode = generateRandomPassword().substring(0, 8).toLowerCase();
    const blobPath = `share/${shareCode}/${file.name}`;

    const clientPayload = JSON.stringify({
      expireDays,
      password: enablePassword ? password!.trim() : null,
    });

    const blobResult = await upload(blobPath, file, {
      access: 'private',
      handleUploadUrl: '/api/upload/init',
      clientPayload,
      multipart: file.size > 10 * 1024 * 1024,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.percentage !== undefined) {
          onProgress?.(Math.round(progressEvent.percentage));
        }
      },
    });

    const completeRes = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blobUrl: blobResult.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        shareCode,
        expireDays,
        password: enablePassword ? password!.trim() : null,
      }),
    });

    const data = await completeRes.json();
    if (!completeRes.ok) {
      throw new Error(data.error || '保存记录失败');
    }

    return { shareCode: data.file.shareCode, fileName: data.file.fileName };
  } catch (directUploadError: unknown) {
    const errorMsg = directUploadError instanceof Error ? directUploadError.message : '未知错误';

    if (file.size <= 4 * 1024 * 1024) {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('expireDays', expireDays);
        if (enablePassword) formData.append('password', password!.trim());

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress?.(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ shareCode: data.file.shareCode, fileName: data.file.fileName });
            } else {
              reject(new Error(data.error || '上传失败'));
            }
          } catch {
            reject(new Error('上传响应解析失败'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('网络错误')));
        xhr.addEventListener('abort', () => reject(new Error('上传已取消')));

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    }

    throw new Error(`直传失败: ${errorMsg}。请刷新页面后重试，或检查网络连接。`);
  }
}
