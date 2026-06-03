const DIRECT_DOWNLOAD_EXTENSIONS = new Set([
  'apk', 'ipa', 'xapk', 'aab', 'zip', 'rar', '7z', 'exe', 'dmg',
]);

export function isDirectDownloadFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return DIRECT_DOWNLOAD_EXTENSIONS.has(ext);
}

export function buildDirectDownloadUrl(
  origin: string,
  shareCode: string,
  password?: string | null,
): string {
  const url = new URL('/api/download', origin);
  url.searchParams.set('code', shareCode);
  if (password?.trim()) {
    url.searchParams.set('password', password.trim());
  }
  return url.toString();
}

export function buildSharePageUrl(origin: string, shareCode: string): string {
  return `${origin}/share/${shareCode}`;
}
