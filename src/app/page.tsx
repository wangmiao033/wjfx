'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import {
  Upload, Link2, Copy, Check, Download, Trash2, File, Clock, HardDrive,
  AlertCircle, Loader2, X, Share2, Trash, User, LogOut, Lock, Eye, EyeOff,
  Shield, ShieldOff, Wand2, Search, ChevronDown, Activity, BarChart3,
  FileUp, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/theme-toggle';

interface SharedFileInfo {
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

interface UploadingFile {
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  shareCode?: string;
  speed?: string;       // 上传速度
  eta?: string;         // 预计剩余时间
  fileSize?: number;    // 文件大小
  startTime?: number;   // 开始时间
  lastLoaded?: number;  // 上次已上传字节数
  lastTime?: number;    // 上次时间戳
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '已过期';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}天后过期`;
  if (hours > 0) return `${hours}小时后过期`;
  return `${Math.floor(diff / (1000 * 60))}分钟后过期`;
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

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const MAX_FILE_SIZE = 500 * 1024 * 1024;

function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [files, setFiles] = useState<SharedFileInfo[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SharedFileInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'downloads'>('date');

  // Upload options
  const [expireDays, setExpireDays] = useState('7');
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      if (res.status === 401) { setFiles([]); return; }
      const data = await res.json();
      if (data.files) setFiles(data.files);
    } catch { /* silently fail */ }
    finally { setInitialLoading(false); }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchFiles();
    else if (status !== 'loading') setInitialLoading(false);
  }, [status, fetchFiles]);

  // 计算上传速度和剩余时间
  const calcSpeed = useCallback((uf: UploadingFile, loaded: number, total: number): Partial<UploadingFile> => {
    const now = Date.now();
    if (!uf.startTime) return { startTime: now, lastLoaded: loaded, lastTime: now };

    const elapsed = now - (uf.lastTime || now);
    if (elapsed < 500) return {}; // 每500ms更新一次速度

    const bytesDelta = loaded - (uf.lastLoaded || 0);
    const speedBps = (bytesDelta / elapsed) * 1000; // bytes per second

    let speed = '';
    if (speedBps > 1024 * 1024) speed = `${(speedBps / 1024 / 1024).toFixed(1)} MB/s`;
    else if (speedBps > 1024) speed = `${(speedBps / 1024).toFixed(0)} KB/s`;
    else speed = `${speedBps.toFixed(0)} B/s`;

    const remaining = total - loaded;
    const etaSeconds = speedBps > 0 ? Math.ceil(remaining / speedBps) : 0;
    let eta = '';
    if (etaSeconds > 60) eta = `约${Math.ceil(etaSeconds / 60)}分钟`;
    else if (etaSeconds > 0) eta = `约${etaSeconds}秒`;

    return { speed, eta, lastLoaded: loaded, lastTime: now };
  }, []);

  // Vercel Blob 客户端直传（大幅提速：跳过服务器中转）
  const uploadFileWithProgress = useCallback(async (
    file: File,
    onProgress: (progress: number, update: Partial<UploadingFile>) => void,
  ): Promise<{ shareCode: string; fileName: string }> => {
    const startTime = Date.now();

    // 尝试客户端直传
    try {
      const { upload } = await import('@vercel/blob/client');
      const shareCode = generateRandomPassword().substring(0, 8).toLowerCase();
      const blobPath = `share/${shareCode}/${file.name}`;

      const clientPayload = JSON.stringify({
        expireDays,
        password: enablePassword && password.trim() ? password.trim() : null,
      });

      console.log(`[Upload] Starting direct upload: ${file.name} (${formatFileSize(file.size)}), multipart=${file.size > 10 * 1024 * 1024}`);

      const blobResult = await upload(blobPath, file, {
        access: 'private',
        handleUploadUrl: '/api/upload/init',
        clientPayload,
        multipart: file.size > 10 * 1024 * 1024, // 大于10MB使用分片上传
        onUploadProgress: (progressEvent) => {
          if (progressEvent.percentage !== undefined) {
            const progress = Math.round(progressEvent.percentage);
            onProgress(progress, {
              speed: progressEvent.percentage > 0 ? undefined : undefined,
            });
          }
        },
      });

      console.log(`[Upload] Direct upload complete: ${blobResult.url}`);

      // 直传成功，创建数据库记录
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
          password: enablePassword && password.trim() ? password.trim() : null,
        }),
      });

      const data = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(data.error || '保存记录失败');
      }

      return { shareCode: data.file.shareCode, fileName: data.file.fileName };
    } catch (directUploadError: any) {
      const errorMsg = directUploadError?.message || '未知错误';
      console.error('[Upload] Direct upload failed:', errorMsg);

      // 小文件（<4MB）可以回退到服务端上传
      if (file.size <= 4 * 1024 * 1024) {
        console.log('[Upload] Falling back to server upload (small file)');
        return new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('expireDays', expireDays);
          if (enablePassword && password.trim()) formData.append('password', password.trim());

          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              onProgress(progress, {});
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

      // 大文件直传失败 - 提供清晰错误信息
      throw new Error(`直传失败: ${errorMsg}。请刷新页面后重试，或检查网络连接。`);
    }
  }, [expireDays, enablePassword, password, calcSpeed]);

  const handleUpload = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;
    if (enablePassword && !password.trim()) {
      toast({ title: '请设置密码', variant: 'destructive' }); return;
    }

    // 初始化上传状态
    const initialUploads: UploadingFile[] = filesToUpload.map(f => ({
      name: f.name,
      progress: 0,
      status: 'uploading' as const,
      fileSize: f.size,
      startTime: Date.now(),
    }));
    setUploadingFiles(initialUploads);

    let successCount = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];

      // 文件大小校验
      if (file.size > MAX_FILE_SIZE) {
        setUploadingFiles(prev => prev.map((u, idx) =>
          idx === i ? { ...u, status: 'error', error: '文件超过500MB' } : u
        ));
        continue;
      }

      try {
        const result = await uploadFileWithProgress(file, (progress, update) => {
          setUploadingFiles(prev => prev.map((u, idx) => {
            if (idx !== i) return u;
            const speedUpdate = calcSpeed(u, progress / 100 * (u.fileSize || file.size), u.fileSize || file.size);
            return { ...u, progress, ...update, ...speedUpdate };
          }));
        });

        setUploadingFiles(prev => prev.map((u, idx) =>
          idx === i ? { ...u, status: 'done', shareCode: result.shareCode, speed: undefined, eta: undefined } : u
        ));
        successCount++;
      } catch (err) {
        setUploadingFiles(prev => prev.map((u, idx) =>
          idx === i ? { ...u, status: 'error', error: err instanceof Error ? err.message : '上传失败', speed: undefined, eta: undefined } : u
        ));
      }
    }

    if (successCount > 0) {
      toast({ title: '上传成功', description: `${successCount} 个文件已上传` });
      await fetchFiles();
    }

    // 5秒后清除完成的上传状态
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(u => u.status === 'uploading'));
    }, 5000);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
  };

  const handleCopyLink = async (shareCode: string, fileId: string) => {
    const link = `${window.location.origin}/share/${shareCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(fileId);
      toast({ title: '链接已复制' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: '复制失败', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/delete', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = await res.json();
      if (data.success) { toast({ title: '删除成功' }); await fetchFiles(); }
      else throw new Error(data.error || '删除失败');
    } catch (err) {
      toast({ title: '删除失败', description: err instanceof Error ? err.message : '未知错误', variant: 'destructive' });
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  const handleCleanupExpired = async () => {
    const expired = files.filter(f => f.isExpired);
    if (!expired.length) return;
    setDeleting(true);
    try {
      for (const file of expired) await fetch('/api/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: file.id }) });
      toast({ title: '清理完成', description: `已清理 ${expired.length} 个过期文件` });
      await fetchFiles();
    } catch { toast({ title: '清理失败', variant: 'destructive' }); }
    finally { setDeleting(false); }
  };

  // Filter and sort files
  const filteredFiles = files
    .filter(f => !searchQuery || f.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.fileName.localeCompare(b.fileName);
        case 'size': return b.fileSize - a.fileSize;
        case 'downloads': return b.downloadCount - a.downloadCount;
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const activeCount = files.filter(f => !f.isExpired).length;
  const expiredCount = files.filter(f => f.isExpired).length;
  const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);
  const totalDownloads = files.reduce((sum, f) => sum + f.downloadCount, 0);

  const userName = session?.user?.name || session?.user?.email || '';
  const userInitial = userName ? userName.charAt(0).toUpperCase() : '?';
  const userEmail = session?.user?.email || '';

  const isUploading = uploadingFiles.some(u => u.status === 'uploading');

  // Loading session
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Not authenticated
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20 flex flex-col">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center"><Share2 className="h-4 w-4 text-white" /></div>
              <span className="font-semibold text-lg">FileShare</span>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg border-0">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                <User className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">请先登录</h2>
                <p className="text-sm text-muted-foreground">登录后即可上传和管理分享的文件</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white h-11" onClick={() => router.push('/login')}>登录</Button>
                <Button variant="outline" className="h-11" onClick={() => router.push('/register')}>注册新账号</Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <footer className="border-t bg-background/50 py-3 text-center text-xs text-muted-foreground mt-auto">FileShare - 简单快捷的文件分享工具</footer>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20 flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center"><Share2 className="h-4 w-4 text-white" /></div>
            <span className="font-semibold text-lg">FileShare</span>
            <Badge variant="secondary" className="text-xs">文件分享</Badge>
          </div>
          <div className="flex items-center gap-3">
            {activeCount > 0 && <span className="text-xs text-muted-foreground hidden sm:inline">{activeCount} 个有效</span>}
            {expiredCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={handleCleanupExpired} disabled={deleting}>
                <Trash className="h-3 w-3 mr-1" /><span className="hidden sm:inline">清理过期</span>
              </Button>
            )}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 px-2 gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-medium">{userInitial}</div>
                  <span className="text-sm hidden sm:inline max-w-[120px] truncate">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ redirect: false }).then(() => router.push('/login'))} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Stats Panel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{files.length}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1"><File className="h-3 w-3" />总文件</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeCount}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1"><Activity className="h-3 w-3" />有效文件</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatFileSize(totalSize)}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1"><HardDrive className="h-3 w-3" />存储用量</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalDownloads}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1"><BarChart3 className="h-3 w-3" />总下载</div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Area */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer group ${
              dragActive ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 scale-[1.01] border-solid'
              : 'border-muted-foreground/20 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-muted/30'}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} disabled={isUploading} />
              {isUploading ? (
                <div className="space-y-3">
                  <FileUp className="h-10 w-10 mx-auto text-emerald-500 animate-pulse" />
                  <p className="text-sm font-medium">正在上传 {uploadingFiles.filter(u => u.status === 'uploading').length} 个文件...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Upload className="h-7 w-7 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">拖拽文件到此处，或<span className="text-emerald-500">点击上传</span></p>
                    <p className="text-xs text-muted-foreground mt-1">支持任意文件格式，单文件最大 500MB，可多选批量上传</p>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Progress List */}
            {uploadingFiles.length > 0 && (
              <div className="space-y-2">
                {uploadingFiles.map((uf, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2">
                    {uf.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-emerald-500 flex-shrink-0" />}
                    {uf.status === 'done' && <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                    {uf.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium truncate">{uf.name} {uf.fileSize ? `(${formatFileSize(uf.fileSize)})` : ''}</p>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {uf.status === 'uploading' ? `${uf.progress}%` : uf.status === 'done' ? '✓ 完成' : '✗ 失败'}
                        </span>
                      </div>
                      {uf.status === 'uploading' && (
                        <>
                          <Progress value={uf.progress} className="h-1.5 mt-1" />
                          {(uf.speed || uf.eta) && (
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                              {uf.speed && <span>{uf.speed}</span>}
                              {uf.eta && <span>剩余 {uf.eta}</span>}
                            </div>
                          )}
                        </>
                      )}
                      {uf.status === 'error' && uf.error && (
                        <p className="text-xs text-destructive mt-0.5">{uf.error}</p>
                      )}
                    </div>
                    {uf.status === 'done' && uf.shareCode && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                        onClick={() => handleCopyLink(uf.shareCode!, `upload-${idx}`)}>
                        {copiedId === `upload-${idx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload options */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">保存时长</Label>
                <Select value={expireDays} onValueChange={setExpireDays} disabled={isUploading}>
                  <SelectTrigger className="h-9"><Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 天</SelectItem>
                    <SelectItem value="7">7 天（推荐）</SelectItem>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="90">90 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">加密方式</Label>
                <div className="flex gap-1.5">
                  <Button type="button" variant={!enablePassword ? 'default' : 'outline'} size="sm"
                    className={`flex-1 h-9 text-xs ${!enablePassword ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                    onClick={() => { setEnablePassword(false); setPassword(''); }}
                    disabled={isUploading}>
                    <ShieldOff className="h-3.5 w-3.5 mr-1.5" />公开分享
                  </Button>
                  <Button type="button" variant={enablePassword ? 'default' : 'outline'} size="sm"
                    className={`flex-1 h-9 text-xs ${enablePassword ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                    onClick={() => setEnablePassword(true)}
                    disabled={isUploading}>
                    <Shield className="h-3.5 w-3.5 mr-1.5" />加密分享
                  </Button>
                </div>
              </div>
            </div>

            {enablePassword && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label htmlFor="upload-password" className="text-xs font-medium text-muted-foreground">提取密码</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="upload-password" type={showPassword ? 'text' : 'password'} placeholder="输入 3-20 位提取密码"
                      value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-10" maxLength={20} disabled={isUploading} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-9 px-3 flex-shrink-0" onClick={() => { setPassword(generateRandomPassword()); setEnablePassword(true); }} disabled={isUploading}>
                    <Wand2 className="h-4 w-4 mr-1.5" />随机
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* File List */}
        {initialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm"><CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-36 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        ) : files.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground whitespace-nowrap">已分享的文件</h2>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="relative max-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="搜索文件..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs" />
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-8 w-auto text-xs gap-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">最新</SelectItem>
                    <SelectItem value="name">名称</SelectItem>
                    <SelectItem value="size">大小</SelectItem>
                    <SelectItem value="downloads">下载量</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <Card key={file.id} className={`border-0 shadow-sm transition-all hover:shadow-md ${file.isExpired ? 'opacity-60' : ''}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl flex-shrink-0">{getFileIcon(file.fileName)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{file.fileName}</p>
                          {file.isExpired && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex-shrink-0">已过期</Badge>}
                          {file.hasPassword && <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{formatFileSize(file.fileSize)}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{file.isExpired ? '已过期' : formatExpiry(file.expiresAt)}</span>
                          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{file.downloadCount} 次</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => handleCopyLink(file.shareCode, file.id)} disabled={file.isExpired}>
                          {copiedId === file.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTarget(file)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {!file.isExpired && (
                      <div className="mt-2 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                          {`${window.location.origin}/share/${file.shareCode}`}
                        </span>
                        <Button variant="ghost" size="sm" className="h-5 px-2 text-[11px] text-emerald-600 hover:text-emerald-700"
                          onClick={() => handleCopyLink(file.shareCode, file.id)}>
                          {copiedId === file.id ? '已复制' : '复制'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {filteredFiles.length === 0 && searchQuery && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">未找到匹配的文件</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="h-8 w-8 opacity-30" />
            </div>
            <p className="text-sm font-medium">还没有分享的文件</p>
            <p className="text-xs mt-1">上传文件即可生成分享链接</p>
          </div>
        )}
      </main>

      <footer className="border-t bg-background/50 py-3 text-center text-xs text-muted-foreground mt-auto">FileShare - 简单快捷的文件分享工具</footer>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除 <span className="font-semibold">{deleteTarget?.fileName}</span> 吗？此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />删除中...</> : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Main page with Suspense for useSearchParams
function HomeContent() {
  const searchParams = useSearchParams();
  const shareCode = searchParams.get('s');

  // Redirect old ?s=code format to /share/code
  const router = useRouter();
  useEffect(() => {
    if (shareCode) {
      router.replace(`/share/${shareCode}`);
    }
  }, [shareCode, router]);

  if (shareCode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return <UploadPage />;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
