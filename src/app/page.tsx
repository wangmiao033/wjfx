'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  Link2,
  Copy,
  Check,
  Download,
  Trash2,
  File,
  Clock,
  HardDrive,
  ChevronDown,
  AlertCircle,
  Loader2,
  X,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface SharedFileInfo {
  id: string;
  fileName: string;
  fileSize: number;
  shareCode: string;
  expiresAt: string;
  createdAt: string;
  downloadCount: number;
  isExpired: boolean;
}

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
    apk: '📱',
    exe: '💻',
    dmg: '🍎',
    zip: '📦',
    rar: '📦',
    '7z': '📦',
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📊',
    pptx: '📊',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    mp4: '🎬',
    mp3: '🎵',
    txt: '📃',
  };
  return iconMap[ext] || '📎';
}

// ==================== Share Page Component ====================
function SharePage({ code }: { code: string }) {
  const [fileInfo, setFileInfo] = useState<SharedFileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    async function fetchFileInfo() {
      try {
        const res = await fetch(`/api/share?code=${code}`);
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setFileInfo(data.file);
        }
      } catch {
        setError('获取文件信息失败');
      } finally {
        setLoading(false);
      }
    }
    fetchFileInfo();
  }, [code]);

  const handleDownload = async () => {
    if (!fileInfo) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/download?code=${code}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '下载失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: '下载开始', description: `${fileInfo.fileName} 正在下载` });
    } catch (err) {
      toast({
        title: '下载失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: '链接已复制', description: '分享链接已复制到剪贴板' });
    } catch {
      toast({ title: '复制失败', description: '请手动复制链接', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
          <p className="text-muted-foreground text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Card className="w-full max-w-md mx-4 border-destructive/30">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">无法访问</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!fileInfo) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <img src="/logo.svg" alt="FileShare" className="h-7 w-7" />
          <span className="font-semibold">FileShare</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-0">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{getFileIcon(fileInfo.fileName)}</div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base font-bold break-all leading-snug">
                    {fileInfo.fileName}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-3 text-xs">
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {fileInfo.isExpired ? (
                <Badge variant="destructive" className="text-xs">
                  已过期
                </Badge>
              ) : (
                <span>{formatExpiry(fileInfo.expiresAt)}</span>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              上传时间：{formatDate(fileInfo.createdAt)}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                disabled={downloading || fileInfo.isExpired}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
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
                <Copy className="h-4 w-4 mr-2" />
                复制链接
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 py-3 text-center text-xs text-muted-foreground">
        FileShare - 简单快捷的文件分享工具
      </footer>
    </div>
  );
}

// ==================== Upload Page Component ====================
function UploadPage() {
  const [files, setFiles] = useState<SharedFileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SharedFileInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload files one by one
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('expireDays', '14');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '上传失败');
        }

        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      }

      toast({
        title: '上传成功',
        description: `${filesToUpload.length} 个文件已上传，分享链接已生成`,
      });

      await fetchFiles();
    } catch (err) {
      toast({
        title: '上传失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleCopyLink = async (shareCode: string, fileId: string) => {
    const link = `${window.location.origin}/?s=${shareCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(fileId);
      toast({ title: '链接已复制', description: '分享链接已复制到剪贴板' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: '复制失败', description: '请手动复制链接', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: '删除成功', description: `${deleteTarget.fileName} 已删除` });
        await fetchFiles();
      } else {
        throw new Error(data.error || '删除失败');
      }
    } catch (err) {
      toast({
        title: '删除失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="FileShare" className="h-7 w-7" />
            <span className="font-semibold text-lg">FileShare</span>
            <Badge variant="secondary" className="text-xs">
              文件分享
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            共 {files.length} 个文件
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Upload Area */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
                dragActive
                  ? 'border-emerald-400 bg-emerald-50/50 scale-[1.01]'
                  : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
                disabled={uploading}
              />

              {uploading ? (
                <div className="space-y-4">
                  <Loader2 className="h-10 w-10 mx-auto text-emerald-500 animate-spin" />
                  <p className="text-sm font-medium">上传中...</p>
                  <Progress value={uploadProgress} className="max-w-xs mx-auto h-2" />
                  <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Upload className="h-7 w-7 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      拖拽文件到此处，或<span className="text-emerald-500">点击上传</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      支持 APK、EXE、ZIP 等任意文件格式，单文件最大 500MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">已分享的文件</h2>
            </div>

            <div className="space-y-2">
              {files.map((file) => (
                <Card
                  key={file.id}
                  className={`border-0 shadow-sm transition-all duration-200 hover:shadow-md ${
                    file.isExpired ? 'opacity-60' : ''
                  }`}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {/* File icon */}
                      <div className="text-2xl flex-shrink-0">
                        {getFileIcon(file.fileName)}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">
                            {file.fileName}
                          </p>
                          {file.isExpired && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                              已过期
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatFileSize(file.fileSize)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {file.isExpired ? '已过期' : formatExpiry(file.expiresAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {file.downloadCount} 次
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleCopyLink(file.shareCode, file.id)}
                          disabled={file.isExpired}
                        >
                          {copiedId === file.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(file)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Share link */}
                    {!file.isExpired && (
                      <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                          {typeof window !== 'undefined'
                            ? `${window.location.origin}/?s=${file.shareCode}`
                            : `/?s=${file.shareCode}`}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-emerald-600 hover:text-emerald-700"
                          onClick={() => handleCopyLink(file.shareCode, file.id)}
                        >
                          {copiedId === file.id ? '已复制' : '复制'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <File className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">还没有分享的文件</p>
            <p className="text-xs mt-1">上传文件即可生成分享链接</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 py-3 text-center text-xs text-muted-foreground mt-auto">
        FileShare - 简单快捷的文件分享工具
      </footer>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 <span className="font-semibold">{deleteTarget?.fileName}</span> 吗？删除后分享链接将失效，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== Main Page ====================
export default function Home() {
  const searchParams = useSearchParams();
  const shareCode = searchParams.get('s');

  if (shareCode) {
    return <SharePage code={shareCode} />;
  }

  return <UploadPage />;
}
