'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Share2, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Check, Send, ArrowLeft,
} from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // 验证码发送相关
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSendCode = useCallback(async () => {
    setError('');
    if (!email.trim()) { setError('请输入邮箱'); return; }
    if (!emailRegex.test(email)) { setError('邮箱格式不正确'); return; }

    setSendingCode(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '发送验证码失败'); return; }
      setCodeSent(true);
      setCountdown(60);
      if (data.devCode) setDevCode(data.devCode);
    } catch {
      setError('发送验证码失败，请重试');
    } finally {
      setSendingCode(false);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !emailRegex.test(email)) { setError('请输入正确的邮箱'); return; }
    if (!verificationCode.trim()) { setError('请输入验证码'); return; }
    if (verificationCode.trim().length !== 6) { setError('验证码为6位数字'); return; }
    if (!newPassword) { setError('请输入新密码'); return; }
    if (newPassword.length < 6) { setError('密码长度至少6位'); return; }
    if (newPassword !== confirmPassword) { setError('两次输入的密码不一致'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          verificationCode: verificationCode.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '重置失败'); return; }
      setSuccess(true);
    } catch {
      setError('重置密码失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                <Check className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold">密码重置成功</h2>
              <p className="text-sm text-muted-foreground">请使用新密码登录</p>
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white h-11 w-full"
                onClick={() => router.push('/login')}
              >
                去登录
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-2">
              <Lock className="h-7 w-7 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-bold">重置密码</CardTitle>
            <CardDescription>通过邮箱验证码重置你的密码</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">邮箱</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="请输入注册邮箱" value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); setCodeSent(false); setDevCode(''); }}
                      className="pl-9 h-11" disabled={loading} autoComplete="email" />
                  </div>
                  <Button type="button" variant="outline" onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0 || loading}
                    className="h-11 px-4 whitespace-nowrap border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                    {sendingCode ? <Loader2 className="h-4 w-4 animate-spin" />
                      : countdown > 0 ? `${countdown}s`
                      : codeSent ? <><Send className="h-3.5 w-3.5 mr-1" />重新发送</>
                      : <><Send className="h-3.5 w-3.5 mr-1" />发送验证码</>}
                  </Button>
                </div>
                {codeSent && !devCode && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="h-3 w-3" />验证码已发送到您的邮箱
                  </p>
                )}
                {devCode && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      开发模式 - 验证码：<strong className="font-mono text-sm">{devCode}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Verification code */}
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium">验证码</Label>
                <div className="relative">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <rect width="18" height="11" x="3" y="8" rx="2" ry="2"/><path d="M7 8V6a5 5 0 0 1 10 0v2"/>
                  </svg>
                  <Input id="code" type="text" inputMode="numeric" maxLength={6} placeholder="请输入6位验证码"
                    value={verificationCode} onChange={(e) => { setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    className="pl-9 h-11 tracking-[0.3em] font-mono text-center text-lg" disabled={loading} autoComplete="one-time-code" />
                </div>
              </div>

              {/* New password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium">新密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="newPassword" type={showPassword ? 'text' : 'password'} placeholder="至少6位新密码"
                    value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                    className="pl-9 pr-10 h-11" disabled={loading} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">确认新密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="再次输入新密码"
                    value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    className="pl-9 h-11" disabled={loading} autoComplete="new-password" />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />重置中...</> : '重置密码'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />返回登录
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
