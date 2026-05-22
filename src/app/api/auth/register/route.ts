import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, verificationCode } = await request.json();

    if (!email || !password || !verificationCode) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 });
    }

    const trimmedEmail = email.trim();

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 });
    }

    // 验证验证码
    const validCode = await db.verificationCode.findFirst({
      where: {
        email: trimmedEmail,
        code: verificationCode,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!validCode) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
    }

    // 检查邮箱是否已注册
    const existingUser = await db.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
    }

    // 标记验证码为已使用
    await db.verificationCode.update({
      where: { id: validCode.id },
      data: { used: true },
    });

    // 清理该邮箱的其他未使用验证码
    await db.verificationCode.updateMany({
      where: { email: trimmedEmail, id: { not: validCode.id }, used: false },
      data: { used: true },
    });

    // 创建用户
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: {
        email: trimmedEmail,
        password: hashedPassword,
        name: name?.trim() || trimmedEmail.split('@')[0],
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: any) {
    console.error('Register error:', error?.message || error);
    return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 });
  }
}
