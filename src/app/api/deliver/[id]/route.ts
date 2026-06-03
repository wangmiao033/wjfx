import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

function serializeRecord(record: {
  id: string;
  productName: string;
  publisher: string;
  developer: string;
  pastProducts: string;
  productNode: string;
  productTypes: string;
  privacyPolicyUrl: string;
  userAgreementUrl: string;
  testAccounts: string;
  status: string;
  shareCode: string | null;
  downloadLink: string | null;
  extractPassword: string | null;
  pushMessage: string | null;
  packageFileName: string | null;
  packageFileSize: number | null;
  attachments: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    productName: record.productName,
    publisher: record.publisher,
    developer: record.developer,
    pastProducts: record.pastProducts,
    productNode: record.productNode,
    productTypes: JSON.parse(record.productTypes || '[]'),
    privacyPolicyUrl: record.privacyPolicyUrl,
    userAgreementUrl: record.userAgreementUrl,
    testAccounts: JSON.parse(record.testAccounts || '[]'),
    status: record.status,
    shareCode: record.shareCode,
    downloadLink: record.downloadLink,
    extractPassword: record.extractPassword,
    pushMessage: record.pushMessage,
    packageFileName: record.packageFileName,
    packageFileSize: record.packageFileSize,
    attachments: JSON.parse(record.attachments || '[]'),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: '会话无效，请重新登录' }, { status: 401 });
    }

    const { id } = await params;

    const record = await db.deliverRecord.findFirst({ where: { id, userId } });
    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ record: serializeRecord(record) });
  } catch (error) {
    console.error('[deliver GET id]', error);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: '会话无效，请重新登录' }, { status: 401 });
    }

    const existing = await db.deliverRecord.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    await db.deliverRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[deliver DELETE]', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
