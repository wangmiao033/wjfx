import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendVerificationCode } from '@/lib/email';

// 生成6位随机验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: '请输入邮箱' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    const trimmedEmail = email.trim();

    // 60秒内不可重复发送
    const recentCode = await db.verificationCode.findFirst({
      where: {
        email: trimmedEmail,
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentCode) {
      const remainingSeconds = Math.ceil(
        (recentCode.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000
      );
      return NextResponse.json(
        { error: `请 ${remainingSeconds} 秒后再试` },
        { status: 429 }
      );
    }

    // 生成验证码
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟过期

    // 保存到数据库
    await db.verificationCode.create({
      data: {
        email: trimmedEmail,
        code,
        expiresAt,
      },
    });

    // 发送邮件
    const result = await sendVerificationCode(trimmedEmail, code);

    const response: any = { success: true, message: '验证码已发送' };
    if (result.devCode) {
      response.devCode = result.devCode;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Send code error:', error?.message || error);
    return NextResponse.json({ error: '发送验证码失败，请重试' }, { status: 500 });
  }
}
