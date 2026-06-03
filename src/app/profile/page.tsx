'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, LogOut, Share2, Package, ArrowLeft, Loader2, Search,
  Copy, Check, Trash2, Pencil, FileText, Clock, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/theme-toggle';
import { deleteDeliverRecord, fetchDeliverRecords } from '@/lib/deliver-api';
import { formatSavedTime, type DeliverRecordDTO } from '@/lib/deliver-types';
import { formatFileSize } from '@/lib/upload-client';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [records, setRecords] = useState<DeliverRecordDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeliverRecordDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      const list = await fetchDeliverRecords();
      setRecords(list);
    } catch (err) {
      toast({
        title: '加载失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (status === 'authenticated') loadRecords();
    else if (status === 'unauthenticated') setLoading(false);
  }, [status, loadRecords]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDeliverRecord(deleteTarget.id);
      setRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
      toast({ title: '已删除' });
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

  const handleCopy = async (record: DeliverRecordDTO) => {
    if (!record.pushMessage) {
      toast({ title: '暂无推送文案', description: '请先完成上传推送', variant: 'destructive' });
      return;
    }
    try {
      await navigator.clipboard.writeText(record.pushMessage);
      setCopiedId(record.id);
      toast({ title: '文案已复制' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: '复制失败', variant: 'destructive' });
    }
  };

  const filtered = records.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.productName.toLowerCase().includes(q) ||
      r.publisher.toLowerCase().includes(q) ||
      r.packageFileName?.toLowerCase().includes(q)
    );
  });

  const userName = session?.user?.name || session?.user?.email || '';
  const userInitial = userName ? userName.charAt(0).toUpperCase() : '?';

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/80 via-background to-muted/50 dark:from-violet-950/20 dark:via-background dark:to-muted/20 flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm hidden sm:inline">返回</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-lg">个人中心</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/deliver">
              <Button variant="ghost" size="sm" className="h-8 text-xs hidden sm:flex">
                <Package className="h-3.5 w-3.5 mr-1.5" />评测交付
              </Button>
            </Link>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 px-2 gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-medium">{userInitial}</div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => signOut({ redirect: false }).then(() => router.push('/login'))} className="text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-violet-500/10 to-blue-500/10">
          <CardContent className="py-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">你好，{userName}</p>
              <p className="text-lg font-semibold mt-0.5">我的提测游戏</p>
              <p className="text-xs text-muted-foreground mt-1">云端保存，换设备登录也能找到</p>
            </div>
            <Link href="/deliver">
              <Button className="bg-violet-500 hover:bg-violet-600 text-white">
                <Package className="h-4 w-4 mr-2" />新建提测
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索游戏名称、发行商..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium">{records.length === 0 ? '还没有提测记录' : '未找到匹配记录'}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">在评测交付页填写资料后点「保存到个人中心」</p>
              <Link href="/deliver">
                <Button variant="outline">去创建提测</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(record => (
              <Card key={record.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{record.productName}</CardTitle>
                      <CardDescription className="mt-1 truncate">
                        {record.publisher || '未填发行商'}
                        {record.packageFileName && ` · ${record.packageFileName}`}
                      </CardDescription>
                    </div>
                    <Badge variant={record.status === 'completed' ? 'default' : 'secondary'} className={record.status === 'completed' ? 'bg-emerald-500' : ''}>
                      {record.status === 'completed' ? '已推送' : '草稿'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatSavedTime(record.updatedAt)}</span>
                    {record.productNode && <span>{record.productNode}</span>}
                    {record.packageFileSize && <span>{formatFileSize(record.packageFileSize)}</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/deliver?id=${record.id}`}>
                      <Button size="sm" variant="default" className="h-8 bg-violet-500 hover:bg-violet-600 text-white">
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        {record.status === 'completed' ? '查看/继续' : '继续编辑'}
                      </Button>
                    </Link>
                    {record.pushMessage && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => handleCopy(record)}>
                        {copiedId === record.id ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                        复制文案
                      </Button>
                    )}
                    {record.downloadLink && (
                      <Button size="sm" variant="outline" className="h-8" asChild>
                        <a href={record.downloadLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />下载链接
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(record)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-0 shadow-sm border-dashed">
          <CardContent className="py-4 flex items-start gap-3">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">智能保存说明</p>
              <p>· 点击「保存到个人中心」→ 保存游戏资料草稿</p>
              <p>· 上传并推送成功后 → 自动保存完整记录（含下载链接和文案）</p>
              <p>· 在个人中心随时找回，点击「继续编辑」恢复全部信息</p>
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deleteTarget?.productName}」的提测记录吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
