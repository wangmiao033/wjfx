'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from 'next-themes';
import {
  Download,
  Copy,
  Clock,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Home,
  QrCode,
  Sun,
  Moon,
  Share2,
  Check,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

// ==================== Types ====================
interface ShareCodePageProps {
  params: Promise<{ code: string }>;
}

interface FileInfo {
  id: string;
  fileName: string;
  fileSize: number;
  shareCode: string;
  expiresAt: string;
  createdAt: string;
  downloadCount: number;
  isExpired: boolean;
  hasPassword?: boolean;
}

// ==================== Utility Functions ====================
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatExpiry(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();
  if (diff <= 0) return '已过期';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}天后过期`;
  if (hours > 0) return `${hours}小时后过期`;
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}分钟后过期`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    apk: '📱', exe: '💻', dmg: '🍎', zip: '📦', rar: '📦', '7z': '📦',
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
    mp4: '🎬', webm: '🎬', mp3: '🎵', wav: '🎵', txt: '📃',
  };
  return iconMap[ext] || '📎';
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
}

function isPdfFile(fileName: string): boolean {
  return getFileExtension(fileName) === 'pdf';
}

function isVideoFile(fileName: string): boolean {
  return ['mp4', 'webm', 'ogg', 'mov'].includes(getFileExtension(fileName));
}

function isAudioFile(fileName: string): boolean {
  return ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(getFileExtension(fileName));
}

function isTextFile(fileName: string): boolean {
  return ['txt', 'md', 'json', 'xml', 'csv', 'log', 'yml', 'yaml', 'ini', 'conf'].includes(getFileExtension(fileName));
}

// ==================== ThemeToggle Component ====================
const emptySubscribe = () => () => {};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="切换主题"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 text-yellow-500" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600" />
      )}
    </Button>
  );
}

// ==================== Signed Media URL Hook ====================
function useSignedPreviewUrl(code: string, password?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const passwordParam = password ? `&password=${encodeURIComponent(password)}` : '';

  React.useEffect(() => {
    async function fetchUrl() {
      try {
        const res = await fetch(`/api/preview-url?code=${code}${passwordParam}`);
        const data = await res.json();
        if (res.ok && data.previewUrl) {
          setUrl(data.previewUrl);
        } else {
          setUrl(`/api/preview?code=${code}${passwordParam}`);
        }
      } catch {
        setUrl(`/api/preview?code=${code}${passwordParam}`);
      }
    }
    fetchUrl();
  }, [code, passwordParam]);

  return url;
}
// ==================== Image Preview Component ====================
function ImagePreview({ code, password }: { code: string; password?: string }) {
  const [imgError, setImgError] = useState(false);
  const previewUrl = useSignedPreviewUrl(code, password);

  if (imgError || !previewUrl) {
    if (!previewUrl) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm bg-muted/30 rounded-lg border border-dashed">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          加载预览...
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm bg-muted/30 rounded-lg border border-dashed">
        <AlertCircle className="h-4 w-4 mr-2" />
        图片预览加载失败
      </div>
    );
  }

  return (
    <div className="flex justify-center rounded-lg overflow-hidden border bg-muted/10">
      <img
        src={previewUrl}
        alt="文件预览"
        className="max-h-72 object-contain"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

// ==================== Signed PDF Preview ====================
function SignedPdfPreview({ code, password }: { code: string; password?: string }) {
  const previewUrl = useSignedPreviewUrl(code, password);

  if (!previewUrl) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm bg-muted/30 rounded-lg border border-dashed">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        加载PDF预览...
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden bg-background">
      <iframe
        src={previewUrl}
        className="w-full"
        style={{ height: '400px' }}
        title="PDF 预览"
      />
    </div>
  );
}

// ==================== Signed Video Preview ====================
function SignedVideoPreview({ code, password }: { code: string; password?: string }) {
  const previewUrl = useSignedPreviewUrl(code, password);

  if (!previewUrl) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm bg-muted/30 rounded-lg border border-dashed">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        加载视频预览...
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden bg-black/5 dark:bg-black/20">
      <video
        src={previewUrl}
        controls
        className="max-h-72 w-full object-contain"
        preload="metadata"
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );
}

// ==================== Signed Audio Preview ====================
function SignedAudioPreview({ code, password, fileName }: { code: string; password?: string; fileName: string }) {
  const previewUrl = useSignedPreviewUrl(code, password);

  if (!previewUrl) {
    return (
      <div className="flex items-center justify-center h-16 text-muted-foreground text-sm bg-muted/30 rounded-lg border border-dashed">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        加载音频...
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 bg-muted/10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
          <Download className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">音频文件</p>
        </div>
      </div>
      <audio
        src={previewUrl}
        controls
        className="w-full"
        preload="metadata"
      >
        您的浏览器不支持音频播放
      </audio>
    </div>
  );
}

// ==================== Main Page Component ====================
export default function ShareCodePage({ params }: ShareCodePageProps) {
  const { code } = React.use(params);

  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { toast } = useToast();

  // Fetch file info on mount
  useEffect(() => {
    async function fetchFileInfo() {
      try {
        const res = await fetch(`/api/share?code=${code}`);
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setFileInfo(data.file);
          // 如果没有密码，直接标记为已验证
          if (!data.file.hasPassword) {
            setPasswordVerified(true);
          }
        }
      } catch {
        setError('获取文件信息失败');
      } finally {
        setLoading(false);
      }
    }
    fetchFileInfo();
  }, [code]);

  // 验证密码
  const handlePasswordVerify = useCallback(() => {
    if (!password.trim()) {
      toast({ title: '请输入提取密码', variant: 'destructive' });
      return;
    }
    // 尝试下载一小部分来验证密码
    // 简单方案：直接标记已验证，下载时服务端会真正验证
    setPasswordVerified(true);
  }, [password, toast]);

  // 高速下载：优先使用签名URL直连Vercel Blob，避免服务器中转
  const handleDownload = useCallback(async () => {
    if (!fileInfo) return;

    // 如果有密码但未验证，提示输入
    if (fileInfo.hasPassword && !passwordVerified) {
      toast({ title: '请先输入提取密码', variant: 'destructive' });
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);

    try {
      const passwordParam = fileInfo.hasPassword && password ? `&password=${encodeURIComponent(password)}` : '';

      // 先尝试获取签名URL直连下载
      try {
        const urlRes = await fetch(`/api/download-url?code=${code}${passwordParam}`);
        const urlData = await urlRes.json();

        if (urlRes.ok && urlData.downloadUrl) {
          // 使用签名URL直接下载（直连Vercel Blob，不经过服务器代理）
          const directUrl = urlData.downloadUrl;

          // 使用 fetch + stream 跟踪进度
          const response = await fetch(directUrl);
          if (!response.ok) throw new Error('直接下载失败');

          const contentLength = response.headers.get('Content-Length');
          const totalBytes = contentLength ? parseInt(contentLength, 10) : fileInfo.fileSize;

          if (!response.body) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileInfo.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            setDownloadProgress(100);
            toast({ title: '下载完成', description: `${fileInfo.fileName} 已下载` });
            return;
          }

          // 流式读取 + 进度跟踪
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let receivedBytes = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedBytes += value.length;
            if (totalBytes > 0) {
              const progress = Math.round((receivedBytes / totalBytes) * 100);
              setDownloadProgress(progress);
            }
          }

          const blob = new Blob(chunks);
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileInfo.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);

          setDownloadProgress(100);
          toast({ title: '下载完成', description: `${fileInfo.fileName} 已下载` });
          return;
        }
      } catch (directError) {
        // 签名URL下载失败，回退到服务器代理模式
        console.log('Direct download failed, falling back to proxy:', directError);
      }

      // 回退：服务器代理下载（兼容本地存储模式）
      const response = await fetch(`/api/download?code=${code}${passwordParam}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: '下载失败' }));
        if (response.status === 403) {
          toast({ title: '密码错误', description: '请检查提取密码', variant: 'destructive' });
          setPasswordVerified(false);
          return;
        }
        throw new Error(data.error || '下载失败');
      }

      const contentLength = response.headers.get('Content-Length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : fileInfo.fileSize;

      if (!response.body) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDownloadProgress(100);
        toast({ title: '下载完成', description: `${fileInfo.fileName} 已下载` });
        return;
      }

      // Stream reading with progress
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        if (totalBytes > 0) {
          const progress = Math.round((receivedBytes / totalBytes) * 100);
          setDownloadProgress(progress);
        }
      }

      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);
      toast({ title: '下载完成', description: `${fileInfo.fileName} 已下载` });
    } catch (err) {
      toast({
        title: '下载失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(0);
      }, 1000);
    }
  }, [fileInfo, code, password, passwordVerified, toast]);

  // Copy link
  const handleCopyLink = useCallback(async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast({ title: '链接已复制', description: '分享链接已复制到剪贴板' });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({ title: '复制失败', description: '请手动复制链接', variant: 'destructive' });
    }
  }, [toast]);

  // ==================== Loading State ====================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
          <p className="text-muted-foreground text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // ==================== Error State ====================
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-6 w-6 text-emerald-500" />
              <span className="font-semibold text-lg">FileShare</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-destructive/30 dark:border-destructive/20">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">无法访问</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-6" asChild>
                <a href="/">
                  <Home className="h-4 w-4 mr-2" />
                  返回首页
                </a>
              </Button>
            </CardContent>
          </Card>
        </main>

        <footer className="border-t bg-background/50 py-3 text-center text-xs text-muted-foreground mt-auto">
          FileShare - 简单快捷的文件分享工具
        </footer>
      </div>
    );
  }

  if (!fileInfo) return null;

  // 密码验证页面（如果有密码且未验证）
  if (fileInfo.hasPassword && !passwordVerified) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-6 w-6 text-emerald-500" />
              <span className="font-semibold text-lg">FileShare</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg border-0">
            <CardContent className="pt-8 space-y-6">
              <div className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                  <Lock className="h-8 w-8 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold">加密分享</h2>
                <p className="text-sm text-muted-foreground">此文件需要提取密码才能访问</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
                  <div className="text-2xl">{getFileIcon(fileInfo.fileName)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{fileInfo.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(fileInfo.fileSize)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                    提取密码
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="请输入提取密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 h-11"
                      onKeyDown={(e) => e.key === 'Enter' && handlePasswordVerify()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handlePasswordVerify}
                  className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  验证密码
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ==================== File Info Page ====================
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-6 w-6 text-emerald-500" />
            <span className="font-semibold text-lg">FileShare</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-lg shadow-lg border-0 dark:border">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="text-4xl flex-shrink-0 leading-none mt-0.5">
                  {getFileIcon(fileInfo.fileName)}
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg font-bold break-all leading-snug">
                    {fileInfo.fileName}
                  </CardTitle>
                  <CardDescription className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatFileSize(fileInfo.fileSize)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {fileInfo.downloadCount} 次下载
                    </span>
                  </CardDescription>
                </div>
              </div>
              {fileInfo.hasPassword && (
                <Badge variant="secondary" className="flex-shrink-0 ml-2 gap-1">
                  <Lock className="h-3 w-3" />
                  加密
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Expiry info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              {fileInfo.isExpired ? (
                <Badge variant="destructive" className="text-xs">已过期</Badge>
              ) : (
                <span>{formatExpiry(fileInfo.expiresAt)}</span>
              )}
            </div>

            {/* Created date */}
            <div className="text-xs text-muted-foreground">
              上传时间：{formatDate(fileInfo.createdAt)}
            </div>

            {/* ===== Previews ===== */}

            {/* Image Preview */}
            {isImageFile(fileInfo.fileName) && !fileInfo.isExpired && (
              <ImagePreview code={code} password={fileInfo.hasPassword ? password : undefined} />
            )}

            {/* PDF Preview */}
            {isPdfFile(fileInfo.fileName) && !fileInfo.isExpired && (
              <SignedPdfPreview code={code} password={fileInfo.hasPassword ? password : undefined} />
            )}

            {/* Video Preview */}
            {isVideoFile(fileInfo.fileName) && !fileInfo.isExpired && (
              <SignedVideoPreview code={code} password={fileInfo.hasPassword ? password : undefined} />
            )}

            {/* Audio Preview */}
            {isAudioFile(fileInfo.fileName) && !fileInfo.isExpired && (
              <SignedAudioPreview code={code} password={fileInfo.hasPassword ? password : undefined} fileName={fileInfo.fileName} />
            )}

            {/* Text file hint */}
            {isTextFile(fileInfo.fileName) && !fileInfo.isExpired && (
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span>文本文件，下载后查看完整内容</span>
              </div>
            )}

            {/* ===== Download Progress ===== */}
            {downloading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>正在下载...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <Progress value={downloadProgress} className="h-2" />
              </div>
            )}

            {/* ===== Action Buttons ===== */}
            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                disabled={fileInfo.isExpired || downloading}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    下载中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    下载文件
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleCopyLink}>
                {copiedLink ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedLink ? '已复制' : '复制链接'}
              </Button>
            </div>

            {/* ===== QR Code Section ===== */}
            <Collapsible open={qrOpen} onOpenChange={setQrOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-center text-muted-foreground hover:text-foreground"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  显示二维码
                  {qrOpen ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex justify-center pt-2">
                  <div className="bg-white rounded-xl border p-4 shadow-sm">
                    <QRCodeSVG
                      value={typeof window !== 'undefined' ? window.location.href : ''}
                      size={160}
                      bgColor="#ffffff"
                      fgColor="#10b981"
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-2">
                  扫描二维码访问分享页面
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* ===== Back to Home ===== */}
            <div className="pt-2 text-center">
              <a
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                返回首页
              </a>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/50 py-3 text-center text-xs text-muted-foreground mt-auto">
        FileShare - 简单快捷的文件分享工具
      </footer>
    </div>
  );
}
