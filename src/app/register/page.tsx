'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Share2, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User, Send, Check, X,
} from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';

function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) strength++;
  return strength;
}

const strengthLabels = ['', '弱', '一般', '较强', '强'];
const strengthColors = [
  'bg-muted',
  'bg-red-500',
  'bg-yellow-500',
  'bg-emerald-400',
  'bg-emerald-500',
];

export default function RegisterPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Verification code
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
  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

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
    if (!password) { setError('请输入密码'); return; }
    if (password.length < 6) { setError('密码长度至少6位'); return; }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: nickname.trim() || undefined,
          verificationCode: verificationCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '注册失败'); return; }

      // Auto sign in after registration
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        // Registration succeeded but auto login failed, redirect to login
        router.push('/login');
        return;
      }

      router.push('/');
    } catch {
      setError('注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/80 via-background to-muted/50 dark:from-emerald-950/20 dark:via-background dark:to-muted/20 flex flex-col">
      {/* Header */}
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

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-md shadow-lg border-0">
          <CardHeader className="text-center space-y-2 pb-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mb-2">
              <User className="h-7 w-7 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-bold">创建账号</CardTitle>
            <CardDescription>注册一个新的 FileShare 账号</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              {/* Nickname (optional) */}
              <div className="space-y-2">
                <Label htmlFor="nickname" className="text-sm font-medium">
                  昵称 <span className="text-muted-foreground font-normal">(可选)</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="设置你的昵称"
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); setError(''); }}
                    className="pl-9 h-11"
                    disabled={loading}
                    autoComplete="nickname"
                  />
                </div>
              </div>

              {/* Email + Send Code */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">邮箱</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="请输入邮箱"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); setCodeSent(false); setDevCode(''); }}
                      className="pl-9 h-11"
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0 || loading}
                    className="h-11 px-4 whitespace-nowrap border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                  >
                    {sendingCode ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : countdown > 0 ? (
                      `${countdown}s`
                    ) : codeSent ? (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1" />
                        重新发送
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1" />
                        发送验证码
                      </>
                    )}
                  </Button>
                </div>
                {codeSent && !devCode && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="h-3 w-3" />验证码已发送到您的邮箱
                  </p>
                )}
                {devCode && (
                  <div className="flex items-center gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <span className="text-xs text-yellow-700 dark:text-yellow-300">
                      开发模式 - 验证码：<strong className="font-mono text-sm">{devCode}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Verification Code */}
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium">验证码</Label>
                <div className="relative">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <rect width="18" height="11" x="3" y="8" rx="2" ry="2" /><path d="M7 8V6a5 5 0 0 1 10 0v2" />
                  </svg>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="请输入6位验证码"
                    value={verificationCode}
                    onChange={(e) => { setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    className="pl-9 h-11 tracking-[0.3em] font-mono text-center text-lg"
                    disabled={loading}
                    autoComplete="one-time-code"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="至少6位密码"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    className="pl-9 pr-10 h-11"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            passwordStrength >= level
                              ? strengthColors[passwordStrength]
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      passwordStrength <= 1 ? 'text-red-500'
                        : passwordStrength === 2 ? 'text-yellow-500'
                        : 'text-emerald-500'
                    }`}>
                      密码强度：{strengthLabels[passwordStrength]}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">确认密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    className="pl-9 pr-10 h-11"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  {confirmPassword.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {passwordsMatch ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-500">两次输入的密码不一致</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-emerald-500">密码一致</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </Button>
            </form>

            {/* Links */}
            <div className="mt-6 text-center text-sm text-muted-foreground">
              已有账号？
              <Link
                href="/login"
                className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors ml-1"
              >
                立即登录
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">FileShare - 简单快捷的文件分享工具</p>
        </div>
      </footer>
    </div>
  );
}
