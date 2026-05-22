/**
 * 邮件发送工具
 *
 * 使用 Resend 发送邮件
 * 如果 RESEND_API_KEY 未设置或发送失败，返回验证码用于开发模式显示
 */

interface SendCodeResult {
  success: boolean;
  devCode?: string; // 开发模式下的验证码
  error?: string;
}

// 延迟初始化 Resend 客户端
let _resend: any = null;

async function getResend() {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) return null;
  try {
    const { Resend } = await import('resend');
    _resend = new Resend(process.env.RESEND_API_KEY);
    return _resend;
  } catch {
    return null;
  }
}

export async function sendVerificationCode(
  email: string,
  code: string
): Promise<SendCodeResult> {
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  // 尝试发送邮件
  const resend = await getResend();
  if (!resend) {
    console.log(`[DEV] 验证码 for ${email}: ${code}`);
    return { success: true, devCode: code };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject: 'FileShare 验证码',
      html: `
        <div style="max-width:480px;margin:0 auto;padding:32px;font-family:system-ui,-apple-system,sans-serif;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="font-size:24px;color:#10b981;margin:0;">FileShare</h1>
            <p style="color:#6b7280;font-size:14px;margin-top:8px;">文件分享验证码</p>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:24px;text-align:center;border:1px solid #e5e7eb;">
            <p style="color:#374151;font-size:14px;margin:0 0 16px;">您的验证码是：</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#10b981;font-family:monospace;">
              ${code}
            </div>
            <p style="color:#9ca3af;font-size:12px;margin-top:16px;">验证码 10 分钟内有效，请勿泄露</p>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">
            如果这不是您的操作，请忽略此邮件
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: true, devCode: code };
    }

    console.log(`Email sent to ${email}, id: ${data?.id}`);
    return { success: true };
  } catch (err: any) {
    console.error('Send email error:', err?.message || err);
    // 发送失败时返回验证码（开发模式回退）
    return { success: true, devCode: code };
  }
}
