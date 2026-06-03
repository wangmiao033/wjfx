'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Package, Upload, Copy, Check, Loader2, Send, User, LogOut,
  Share2, Lock, Eye, EyeOff, Wand2, FileUp, ArrowLeft, ClipboardCheck,
  FileText, ImagePlus, X, KeyRound, Plus, History, Trash2, Save, Cloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/theme-toggle';
import { uploadFile, generateRandomPassword, formatFileSize } from '@/lib/upload-client';
import { buildDirectDownloadUrl } from '@/lib/share-links';
import {
  PRODUCT_TYPES, DEFAULT_PRIVACY_URL, DEFAULT_AGREEMENT_URL,
  MAX_TEST_ACCOUNTS, MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS,
  defaultDeliverForm, createTestAccount, formatSavedTime, buildPushMessage,
  recordToForm, recordToTestAccounts,
  type DeliverForm, type TestAccount, type UploadedAttachment, type DeliverRecordDTO,
} from '@/lib/deliver-types';
import { fetchDeliverRecord, saveDeliverRecord } from '@/lib/deliver-api';

const STORAGE_KEY = 'deliver-form-v3';
const RESULT_STORAGE_KEY = 'deliver-last-result-v1';
const HISTORY_STORAGE_KEY = 'deliver-history-v1';
const MAX_HISTORY = 20;

interface AttachmentItem {
  id: string;
  file: File;
  preview: string;
}

interface SavedDeliverResult {
  shareCode: string;
  shareLink: string;
  message: string;
  fileName: string;
  productName: string;
  savedAt: string;
}

function loadDeliverHistory(): SavedDeliverResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDeliverResult(entry: SavedDeliverResult) {
  try {
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(entry));
    const history = loadDeliverHistory().filter(h => h.shareCode !== entry.shareCode);
    history.unshift(entry);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

function DeliverPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<AttachmentItem[]>([]);

  const [form, setForm] = useState<DeliverForm>(defaultDeliverForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([createTestAccount()]);
  const [showTestPasswords, setShowTestPasswords] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const formRef = useRef(form);
  const testAccountsRef = useRef(testAccounts);
  formRef.current = form;
  testAccountsRef.current = testAccounts;
  const [expireDays, setExpireDays] = useState('30');
  const [enablePassword, setEnablePassword] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<{ shareCode: string; shareLink: string; message: string; fileName?: string; productName?: string; savedAt?: string } | null>(null);
  const [history, setHistory] = useState<SavedDeliverResult[]>([]);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoPushed, setAutoPushed] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const cloudId = searchParams.get('id');

  const saveFormDefaults = useCallback((data: DeliverForm, accounts: TestAccount[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        productName: data.productName,
        publisher: data.publisher,
        developer: data.developer,
        pastProducts: data.pastProducts,
        productNode: data.productNode,
        productTypes: data.productTypes,
        privacyPolicyUrl: data.privacyPolicyUrl,
        userAgreementUrl: data.userAgreementUrl,
        testAccounts: accounts.map(({ account, password, server }) => ({ account, password, server })),
      }));
    } catch { /* ignore */ }
  }, []);

  const applyCloudRecord = useCallback((record: DeliverRecordDTO) => {
    const nextForm = recordToForm(record);
    const nextAccounts = recordToTestAccounts(record);
    setForm(nextForm);
    setTestAccounts(nextAccounts);
    setRecordId(record.id);
    setCloudSynced(true);
    saveFormDefaults(nextForm, nextAccounts);
    if (record.shareCode && record.pushMessage) {
      setResult({
        shareCode: record.shareCode,
        shareLink: record.downloadLink || '',
        message: record.pushMessage,
        fileName: record.packageFileName || undefined,
        productName: record.productName,
        savedAt: record.updatedAt,
      });
      setRestoredFromStorage(true);
      if (record.extractPassword) {
        setEnablePassword(true);
        setPassword(record.extractPassword);
      }
    }
  }, [saveFormDefaults]);

  const saveToCloud = useCallback(async (opts: {
    status: 'draft' | 'completed';
    shareCode?: string;
    downloadLink?: string;
    extractPassword?: string | null;
    pushMessage?: string;
    packageFileName?: string;
    packageFileSize?: number;
    attachments?: UploadedAttachment[];
  }) => {
    if (!form.productName.trim()) {
      toast({ title: '请填写产品名称', variant: 'destructive' });
      return null;
    }
    setSavingDraft(true);
    try {
      const record = await saveDeliverRecord({
        id: recordId,
        status: opts.status,
        form,
        testAccounts: testAccounts.map(({ account, password, server }) => ({ account, password, server })),
        shareCode: opts.shareCode ?? result?.shareCode ?? null,
        downloadLink: opts.downloadLink ?? result?.shareLink ?? null,
        extractPassword: opts.extractPassword ?? (enablePassword ? password.trim() : null),
        pushMessage: opts.pushMessage ?? result?.message ?? null,
        packageFileName: opts.packageFileName ?? result?.fileName ?? null,
        packageFileSize: opts.packageFileSize ?? null,
        attachments: opts.attachments,
      });
      setRecordId(record.id);
      setCloudSynced(true);
      if (!cloudId) {
        router.replace(`/deliver?id=${record.id}`, { scroll: false });
      }
      return record;
    } catch (err) {
      toast({
        title: '云端保存失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSavingDraft(false);
    }
  }, [form, testAccounts, recordId, result, enablePassword, password, cloudId, router, toast]);

  const handleSaveDraft = async () => {
    const record = await saveToCloud({ status: 'draft' });
    if (record) {
      toast({ title: '已保存到个人中心', description: '下次可在个人中心继续编辑' });
    }
  };

  // 从 localStorage 恢复表单默认值（无云端 id 时）
  useEffect(() => {
    if (cloudId) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DeliverForm> & {
          testAccounts?: Pick<TestAccount, 'account' | 'password' | 'server'>[];
        };
        setForm(prev => ({
          ...prev,
          ...parsed,
          productTypes: parsed.productTypes || [],
          privacyPolicyUrl: parsed.privacyPolicyUrl || DEFAULT_PRIVACY_URL,
          userAgreementUrl: parsed.userAgreementUrl || DEFAULT_AGREEMENT_URL,
        }));
        if (parsed.testAccounts?.length) {
          setTestAccounts(parsed.testAccounts.map(a => ({
            ...createTestAccount(),
            account: a.account || '',
            password: a.password || '',
            server: a.server || '',
          })));
        }
      }

      const savedResultRaw = localStorage.getItem(RESULT_STORAGE_KEY);
      if (savedResultRaw) {
        const saved = JSON.parse(savedResultRaw) as SavedDeliverResult;
        if (saved.shareCode && saved.message) {
          setResult({
            shareCode: saved.shareCode,
            shareLink: saved.shareLink,
            message: saved.message,
            fileName: saved.fileName,
            productName: saved.productName,
            savedAt: saved.savedAt,
          });
          setRestoredFromStorage(true);
        }
      }

      setHistory(loadDeliverHistory());
    } catch { /* ignore */ }
  }, [cloudId]);

  useEffect(() => {
    if (status !== 'authenticated' || !cloudId) return;
    let cancelled = false;
    (async () => {
      try {
        const record = await fetchDeliverRecord(cloudId);
        if (!cancelled) {
          applyCloudRecord(record);
          toast({ title: '已从个人中心恢复', description: record.productName || '草稿' });
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: '加载记录失败',
            description: err instanceof Error ? err.message : '未知错误',
            variant: 'destructive',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [status, cloudId, applyCloudRecord, toast]);

  attachmentsRef.current = attachments;

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach(a => URL.revokeObjectURL(a.preview));
    };
  }, []);

  const persistTestAccounts = useCallback((accounts: TestAccount[]) => {
    saveFormDefaults(formRef.current, accounts);
  }, [saveFormDefaults]);

  const updateForm = (patch: Partial<DeliverForm>) => {
    setForm(prev => {
      const next = { ...prev, ...patch };
      saveFormDefaults(next, testAccountsRef.current);
      return next;
    });
  };

  const toggleProductType = (type: string) => {
    setForm(prev => {
      const types = prev.productTypes.includes(type)
        ? prev.productTypes.filter(t => t !== type)
        : [...prev.productTypes, type];
      const next = { ...prev, productTypes: types };
      saveFormDefaults(next, testAccountsRef.current);
      return next;
    });
  };

  const handleAddAttachments = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      toast({ title: '请选择图片文件', description: '支持 JPG、PNG、GIF、WebP', variant: 'destructive' });
      return;
    }

    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      toast({ title: '附件数量已达上限', description: `最多 ${MAX_ATTACHMENTS} 张`, variant: 'destructive' });
      return;
    }

    const toAdd: AttachmentItem[] = [];
    for (const file of files.slice(0, remaining)) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast({ title: `${file.name} 超过 20MB`, variant: 'destructive' });
        continue;
      }
      toAdd.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (toAdd.length > 0) {
      setAttachments(prev => [...prev, ...toAdd]);
      setResult(null);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const item = prev.find(a => a.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(a => a.id !== id);
    });
    setResult(null);
  };

  const updateTestAccount = (id: string, patch: Partial<Omit<TestAccount, 'id'>>) => {
    setTestAccounts(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...patch } : a);
      persistTestAccounts(next);
      return next;
    });
    setResult(null);
  };

  const addTestAccount = () => {
    if (testAccounts.length >= MAX_TEST_ACCOUNTS) {
      toast({ title: '测试账号已达上限', description: `最多 ${MAX_TEST_ACCOUNTS} 个`, variant: 'destructive' });
      return;
    }
    setTestAccounts(prev => {
      const next = [...prev, createTestAccount()];
      persistTestAccounts(next);
      return next;
    });
    setResult(null);
  };

  const removeTestAccount = (id: string) => {
    setTestAccounts(prev => {
      if (prev.length <= 1) {
        const empty = { ...prev[0], account: '', password: '', server: '' };
        persistTestAccounts([empty]);
        return [empty];
      }
      const next = prev.filter(a => a.id !== id);
      persistTestAccounts(next);
      return next;
    });
    setResult(null);
  };

  const pushToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setAutoPushed(true);
    setTimeout(() => setCopied(false), 3000);
  }, []);

  const handleSubmit = async () => {
    if (!form.productName.trim()) {
      toast({ title: '请填写产品名称', variant: 'destructive' });
      return;
    }
    if (!selectedFile) {
      toast({ title: '请选择评测包文件', variant: 'destructive' });
      return;
    }
    if (enablePassword && !password.trim()) {
      toast({ title: '请设置提取密码', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setResult(null);
    setAutoPushed(false);

    try {
      const totalFiles = 1 + attachments.length;
      let completedFiles = 0;

      const trackProgress = (fileProgress: number) => {
        const overall = ((completedFiles + fileProgress / 100) / totalFiles) * 100;
        setUploadProgress(Math.round(overall));
      };

      const uploadOpts = {
        expireDays,
        password: enablePassword ? password.trim() : null,
      };

      const uploadResult = await uploadFile(selectedFile, {
        ...uploadOpts,
        onProgress: trackProgress,
      });
      completedFiles++;
      setUploadProgress(Math.round((completedFiles / totalFiles) * 100));

      const uploadedAttachments: UploadedAttachment[] = [];
      for (const att of attachments) {
        const attResult = await uploadFile(att.file, {
          expireDays,
          password: null,
          onProgress: trackProgress,
        });
        completedFiles++;
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));
        uploadedAttachments.push({
          fileName: att.file.name,
          shareLink: buildDirectDownloadUrl(window.location.origin, attResult.shareCode),
        });
      }

      const shareCode = uploadResult.shareCode;
      const downloadLink = buildDirectDownloadUrl(
        window.location.origin,
        shareCode,
        enablePassword ? password.trim() : null,
      );
      const message = buildPushMessage(
        form,
        downloadLink,
        enablePassword ? password.trim() : null,
        uploadedAttachments,
        testAccounts,
      );

      setResult({ shareCode, shareLink: downloadLink, message });
      setRestoredFromStorage(false);

      const savedEntry: SavedDeliverResult = {
        shareCode,
        shareLink: downloadLink,
        message,
        fileName: selectedFile.name,
        productName: form.productName,
        savedAt: new Date().toISOString(),
      };
      saveDeliverResult(savedEntry);
      setHistory(loadDeliverHistory());

      const cloudRecord = await saveToCloud({
        status: 'completed',
        shareCode,
        downloadLink,
        extractPassword: enablePassword ? password.trim() : null,
        pushMessage: message,
        packageFileName: selectedFile.name,
        packageFileSize: selectedFile.size,
        attachments: uploadedAttachments,
      });

      try {
        await pushToClipboard(message);
        toast({
          title: cloudRecord ? '上传成功，已推送到剪贴板并保存到个人中心' : '上传成功，已推送到剪贴板',
          description: '切换到微信，直接粘贴发送给客户即可',
        });
      } catch {
        toast({
          title: '上传成功',
          description: '自动复制失败，请手动点击下方复制按钮',
        });
      }

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (err) {
      toast({
        title: '上传失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!result) return;
    try {
      await pushToClipboard(result.message);
      toast({ title: '文案已复制', description: '可直接粘贴到微信发送给客户' });
    } catch {
      toast({ title: '复制失败', variant: 'destructive' });
    }
  };

  const handleCopyLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shareLink);
      toast({ title: '链接已复制' });
    } catch {
      toast({ title: '复制失败', variant: 'destructive' });
    }
  };

  const restoreHistoryItem = (item: SavedDeliverResult) => {
    setResult({
      shareCode: item.shareCode,
      shareLink: item.shareLink,
      message: item.message,
      fileName: item.fileName,
      productName: item.productName,
      savedAt: item.savedAt,
    });
    setRestoredFromStorage(true);
    setAutoPushed(false);
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const clearDeliverHistory = () => {
    try {
      localStorage.removeItem(RESULT_STORAGE_KEY);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch { /* ignore */ }
    setHistory([]);
    setResult(null);
    setRestoredFromStorage(false);
    toast({ title: '历史记录已清除' });
  };

  const userName = session?.user?.name || session?.user?.email || '';
  const userInitial = userName ? userName.charAt(0).toUpperCase() : '?';
  const userEmail = session?.user?.email || '';

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50/80 via-background to-muted/50 dark:from-blue-950/20 dark:via-background dark:to-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/80 via-background to-muted/50 dark:from-blue-950/20 dark:via-background dark:to-muted/20 flex flex-col">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-lg">评测包交付</span>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg border-0">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                <User className="h-8 w-8 text-blue-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">请先登录</h2>
                <p className="text-sm text-muted-foreground">登录后即可上传评测包并生成推送文案</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white h-11" onClick={() => router.push('/login')}>登录</Button>
                <Button variant="outline" className="h-11" onClick={() => router.push('/register')}>注册新账号</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/80 via-background to-muted/50 dark:from-blue-950/20 dark:via-background dark:to-muted/20 flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm hidden sm:inline">返回</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-lg">评测包交付</span>
              <Badge variant="secondary" className="text-xs">一键推送</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 text-xs hidden sm:flex">
                <Share2 className="h-3.5 w-3.5 mr-1.5" />文件分享
              </Button>
            </Link>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 px-2 gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">{userInitial}</div>
                  <span className="text-sm hidden sm:inline max-w-[100px] truncate">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/profile"><User className="h-4 w-4 mr-2" />个人中心</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ redirect: false }).then(() => router.push('/login'))} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        {/* 产品信息表单 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                  产品信息
                </CardTitle>
                <CardDescription className="mt-1">填写游戏资料，可随时保存到个人中心</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {cloudSynced && (
                  <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-300">
                    <Cloud className="h-3 w-3" />已同步云端
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={savingDraft || uploading}
                  onClick={handleSaveDraft}
                >
                  {savingDraft ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  保存到个人中心
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="productName" className="text-xs">产品名称 *</Label>
                <Input id="productName" placeholder="如：帝国雄师" value={form.productName}
                  onChange={e => updateForm({ productName: e.target.value })} disabled={uploading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="publisher" className="text-xs">发行商</Label>
                <Input id="publisher" placeholder="如：XX游戏" value={form.publisher}
                  onChange={e => updateForm({ publisher: e.target.value })} disabled={uploading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="developer" className="text-xs">产品研发</Label>
                <Input id="developer" placeholder="如：XX工作室" value={form.developer}
                  onChange={e => updateForm({ developer: e.target.value })} disabled={uploading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pastProducts" className="text-xs">研发过往产品</Label>
                <Input id="pastProducts" placeholder="如：不朽大陆" value={form.pastProducts}
                  onChange={e => updateForm({ pastProducts: e.target.value })} disabled={uploading} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="productNode" className="text-xs">产品节点</Label>
              <Input id="productNode" placeholder="如：2026.Q2 删档测试，首发时间待定" value={form.productNode}
                onChange={e => updateForm({ productNode: e.target.value })} disabled={uploading} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">产品类型</Label>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_TYPES.map(type => (
                  <label key={type} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    form.productTypes.includes(type)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-background hover:bg-muted border-border'
                  }`}>
                    <Checkbox
                      checked={form.productTypes.includes(type)}
                      onCheckedChange={() => toggleProductType(type)}
                      className="hidden"
                      disabled={uploading}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 合规链接 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              合规链接
            </CardTitle>
            <CardDescription>隐私政策和用户协议链接，会一并写入推送文案</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="privacyPolicyUrl" className="text-xs">隐私政策</Label>
              <Input
                id="privacyPolicyUrl"
                type="url"
                placeholder="https://..."
                value={form.privacyPolicyUrl}
                onChange={e => updateForm({ privacyPolicyUrl: e.target.value })}
                disabled={uploading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="userAgreementUrl" className="text-xs">用户协议</Label>
              <Input
                id="userAgreementUrl"
                type="url"
                placeholder="https://..."
                value={form.userAgreementUrl}
                onChange={e => updateForm({ userAgreementUrl: e.target.value })}
                disabled={uploading}
              />
            </div>
          </CardContent>
        </Card>

        {/* 附件图片 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-blue-500" />
              附件图片
            </CardTitle>
            <CardDescription>上传游戏详情、版号信息等截图，自动生成分享链接写入文案（可选）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer group ${
                attachments.length > 0
                  ? 'border-blue-200 bg-blue-50/20 dark:bg-blue-950/10'
                  : 'border-muted-foreground/20 hover:border-blue-300 hover:bg-muted/30'
              }`}
              onClick={() => !uploading && attachmentInputRef.current?.click()}
            >
              <input
                ref={attachmentInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                multiple
                onChange={e => {
                  if (e.target.files?.length) handleAddAttachments(e.target.files);
                  e.target.value = '';
                }}
                disabled={uploading}
              />
              <ImagePlus className="h-7 w-7 mx-auto text-muted-foreground group-hover:text-blue-500 transition-colors mb-2" />
              <p className="text-sm font-medium">点击添加图片附件</p>
              <p className="text-xs text-muted-foreground mt-1">
                支持 JPG / PNG / GIF / WebP，单张最大 20MB，最多 {MAX_ATTACHMENTS} 张
              </p>
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {attachments.map(att => (
                  <div key={att.id} className="relative group rounded-lg border overflow-hidden bg-muted/30">
                    <img
                      src={att.preview}
                      alt={att.file.name}
                      className="w-full h-24 object-cover"
                    />
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] font-medium truncate">{att.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(att.file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={uploading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 测试账号 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-blue-500" />
                  测试账号
                </CardTitle>
                <CardDescription className="mt-1">APK 评测用登录账号，会写入推送文案（可选）</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-shrink-0"
                onClick={addTestAccount}
                disabled={uploading || testAccounts.length >= MAX_TEST_ACCOUNTS}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />添加账号
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {testAccounts.map((acc, index) => (
              <div key={acc.id} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {testAccounts.length > 1 ? `账号 ${index + 1}` : '测试账号'}
                  </span>
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowTestPasswords(!showTestPasswords)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        disabled={uploading}
                      >
                        {showTestPasswords ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showTestPasswords ? '隐藏密码' : '显示密码'}
                      </button>
                    )}
                    {testAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTestAccount(acc.id)}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">登录账号</Label>
                    <Input
                      placeholder="如：test001"
                      value={acc.account}
                      onChange={e => updateTestAccount(acc.id, { account: e.target.value })}
                      disabled={uploading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">登录密码</Label>
                    <Input
                      type={showTestPasswords ? 'text' : 'password'}
                      placeholder="如：123456"
                      value={acc.password}
                      onChange={e => updateTestAccount(acc.id, { password: e.target.value })}
                      disabled={uploading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">区服（可选）</Label>
                    <Input
                      placeholder="如：1区 / S1"
                      value={acc.server}
                      onChange={e => updateTestAccount(acc.id, { server: e.target.value })}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 评测包上传 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-500" />
              评测包上传
            </CardTitle>
            <CardDescription>上传 APK / IPA / ZIP 等评测包，自动生成网盘分享链接</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer group ${
                selectedFile
                  ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/20'
                  : 'border-muted-foreground/20 hover:border-blue-300 hover:bg-muted/30'
              }`}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".apk,.ipa,.zip,.rar,.7z,.aab,.xapk"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setSelectedFile(f); setResult(null); }
                }}
                disabled={uploading}
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileUp className="h-8 w-8 mx-auto text-blue-500" />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)} · 点击更换文件</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-blue-500 transition-colors" />
                  <p className="text-sm font-medium">点击选择评测包文件</p>
                  <p className="text-xs text-muted-foreground">支持 APK、IPA、ZIP 等，最大 500MB</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">链接有效期</Label>
                <Select value={expireDays} onValueChange={setExpireDays} disabled={uploading}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 天</SelectItem>
                    <SelectItem value="30">30 天（推荐）</SelectItem>
                    <SelectItem value="90">90 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">提取密码</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="提取密码"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setEnablePassword(true); }}
                      className="pl-9 pr-9 h-9"
                      maxLength={20}
                      disabled={uploading}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-9 px-3 flex-shrink-0"
                    onClick={() => { setPassword(generateRandomPassword()); setEnablePassword(true); }}
                    disabled={uploading}>
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">正在上传...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <Button
              className="w-full h-11 bg-blue-500 hover:bg-blue-600 text-white"
              onClick={handleSubmit}
              disabled={uploading || !selectedFile || !form.productName.trim()}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />上传推送中 {uploadProgress}%</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />上传并推送</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 推送文案预览 */}
        {result && (
          <Card ref={resultRef} className="border-0 shadow-sm border-l-4 border-l-emerald-500 animate-in slide-in-from-bottom-4 duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                {autoPushed ? '已上传并推送到剪贴板' : restoredFromStorage ? '推送记录（已保存）' : '推送文案已就绪'}
              </CardTitle>
              <CardDescription>
                {autoPushed
                  ? '文案已在剪贴板，切换到微信粘贴发送即可'
                  : restoredFromStorage
                    ? '刷新页面后已自动恢复，可随时重新复制'
                    : '复制下方文案，直接粘贴到微信群发送给客户'}
              </CardDescription>
              {(result.fileName || result.savedAt) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {result.productName && (
                    <Badge variant="secondary" className="text-[10px]">{result.productName}</Badge>
                  )}
                  {result.fileName && (
                    <Badge variant="outline" className="text-[10px] font-normal">{result.fileName}</Badge>
                  )}
                  {result.savedAt && (
                    <span className="text-[10px] text-muted-foreground">{formatSavedTime(result.savedAt)}</span>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {autoPushed && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    推送内容已复制，在微信聊天框按 Ctrl+V 粘贴发送
                  </p>
                </div>
              )}
              <Textarea
                readOnly
                value={result.message}
                className="min-h-[220px] font-mono text-sm leading-relaxed resize-none bg-muted/30"
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-10"
                  onClick={handleCopyMessage}
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? '已复制' : autoPushed ? '重新复制' : '一键复制推送文案'}
                </Button>
                <Button variant="outline" className="h-10" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />复制下载链接
                </Button>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{result.shareLink}</span>
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">已上传</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 历史推送记录 */}
        {history.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    历史推送记录
                  </CardTitle>
                  <CardDescription className="mt-1">
                    本机缓存（最近 {MAX_HISTORY} 条）· 完整记录请前往
                    <Link href="/profile" className="text-blue-500 hover:underline mx-1">个人中心</Link>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Link href="/profile">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                      <User className="h-3.5 w-3.5 mr-1" />个人中心
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    onClick={clearDeliverHistory}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />清空
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.map(item => (
                <button
                  key={`${item.shareCode}-${item.savedAt}`}
                  type="button"
                  onClick={() => restoreHistoryItem(item)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50 ${
                    result?.shareCode === item.shareCode ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{item.productName || '未命名产品'}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatSavedTime(item.savedAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.fileName}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t bg-background/50 py-3 text-center text-xs text-muted-foreground mt-auto">
        评测包交付 · 资料云端保存 · 上传即推送至剪贴板
      </footer>
    </div>
  );
}

export default function DeliverPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DeliverPageContent />
    </Suspense>
  );
}
