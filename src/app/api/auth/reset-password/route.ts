import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, verificationCode, newPassword } = await request.json();

    if (!email || !verificationCode || !newPassword) {
      return NextResponse.json({ error: '请填写所有字段' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    // 验证验证码
    let validCode = null;
    try {
      validCode = await db.verificationCode.findFirst({
        where: {
          email,
          code: verificationCode,
          used: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbError: any) {
      console.error('DB error checking verification code:', dbError.message);
      return NextResponse.json({ error: '系统繁忙，请稍后重试' }, { status: 500 });
    }

    if (!validCode) {
      return NextResponse.json({ error: '验证码错误或已过期，请重新获取' }, { status: 400 });
    }

    // 检查用户是否存在
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: '该邮箱未注册' }, { status: 404 });
    }

    // 将验证码标记为已使用
    try {
      await db.verificationCode.update({
        where: { id: validCode.id },
        data: { used: true },
      });
      // 清理该邮箱的其他未使用验证码
      await db.verificationCode.updateMany({
        where: { email, id: { not: validCode.id }, used: false },
        data: { used: true },
      });
    } catch (dbError: any) {
      console.error('DB error updating verification code:', dbError.message);
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true, message: '密码重置成功' });
  } catch (error: any) {
    console.error('Reset password error:', error?.message || error);
    return NextResponse.json({ error: '重置密码失败，请重试' }, { status: 500 });
  }
}
