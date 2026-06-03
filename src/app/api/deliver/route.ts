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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const records = await db.deliverRecord.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      records: records.map(serializeRecord),
    });
  } catch (error) {
    console.error('[deliver GET]', error);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();
    const { id, status, form, testAccounts, shareCode, downloadLink, extractPassword, pushMessage, packageFileName, packageFileSize, attachments } = body;

    if (!form?.productName?.trim()) {
      return NextResponse.json({ error: '请填写产品名称' }, { status: 400 });
    }

    const data = {
      productName: form.productName.trim(),
      publisher: form.publisher?.trim() || '',
      developer: form.developer?.trim() || '',
      pastProducts: form.pastProducts?.trim() || '',
      productNode: form.productNode?.trim() || '',
      productTypes: JSON.stringify(form.productTypes || []),
      privacyPolicyUrl: form.privacyPolicyUrl?.trim() || '',
      userAgreementUrl: form.userAgreementUrl?.trim() || '',
      testAccounts: JSON.stringify(testAccounts || []),
      status: status === 'completed' ? 'completed' : 'draft',
      shareCode: shareCode || null,
      downloadLink: downloadLink || null,
      extractPassword: extractPassword || null,
      pushMessage: pushMessage || null,
      packageFileName: packageFileName || null,
      packageFileSize: packageFileSize ?? null,
      attachments: JSON.stringify(attachments || []),
    };

    let record;
    if (id) {
      const existing = await db.deliverRecord.findFirst({ where: { id, userId } });
      if (!existing) {
        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }
      record = await db.deliverRecord.update({
        where: { id },
        data,
      });
    } else {
      record = await db.deliverRecord.create({
        data: { ...data, userId },
      });
    }

    return NextResponse.json({ record: serializeRecord(record) });
  } catch (error) {
    console.error('[deliver POST]', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
