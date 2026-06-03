'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Share2, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User,
} from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';

type LoginMode = 'email' | 'account';

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<LoginMode>('account');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError(loginMode === 'email' ? '请输入邮箱' : '请输入账号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: identifier.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('邮箱/账号或密码错误，请重试');
        return;
      }

      router.push('/');
    } catch {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20 flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Share2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-lg">FileShare</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-0">
          <CardHeader className="text-center space-y-2 pb-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mb-2">
              {loginMode === 'email' ? (
                <Mail className="h-7 w-7 text-emerald-500" />
              ) : (
                <User className="h-7 w-7 text-emerald-500" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">登录</CardTitle>
            <CardDescription>登录你的 FileShare 账号</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              <div className="flex rounded-lg border bg-muted/30 p-1">
                <button
                  type="button"
                  className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${
                    loginMode === 'account'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => { setLoginMode('account'); setError(''); }}
                  disabled={loading}
                >
                  账号登录
                </button>
                <button
                  type="button"
                  className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${
                    loginMode === 'email'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => { setLoginMode('email'); setError(''); }}
                  disabled={loading}
                >
                  邮箱登录
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm font-medium">
                  {loginMode === 'email' ? '邮箱' : '账号'}
                </Label>
                <div className="relative">
                  {loginMode === 'email' ? (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    id="identifier"
                    type={loginMode === 'email' ? 'email' : 'text'}
                    placeholder={loginMode === 'email' ? '请输入邮箱' : '请输入账号，如 admin'}
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                    className="pl-9 h-11"
                    disabled={loading}
                    autoComplete={loginMode === 'email' ? 'email' : 'username'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    className="pl-9 pr-10 h-11"
                    disabled={loading}
                    autoComplete="current-password"
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
                type="submit"
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm">
              <Link
                href="/forgot-password"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                忘记密码？
              </Link>
              <Link
                href="/register"
                className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors"
              >
                注册新账号
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">FileShare - 简单快捷的文件分享工具</p>
        </div>
      </footer>
    </div>
  );
}
