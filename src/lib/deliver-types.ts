export const PRODUCT_TYPES = ['挂机', '卡牌', 'SLG', 'MMO', 'RPG', '休闲', '塔防', '模拟经营'] as const;

export const DEFAULT_PRIVACY_URL = 'https://privacy.hnchpower.cn/document-policy.html?id=UU7zYCRl';
export const DEFAULT_AGREEMENT_URL = 'http://fghx.ibox.com.cn/sdk/Privacy_xd.html';

export const MAX_TEST_ACCOUNTS = 5;
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

export interface DeliverForm {
  productName: string;
  publisher: string;
  developer: string;
  pastProducts: string;
  productNode: string;
  productTypes: string[];
  privacyPolicyUrl: string;
  userAgreementUrl: string;
}

export interface TestAccountData {
  account: string;
  password: string;
  server: string;
}

export interface TestAccount extends TestAccountData {
  id: string;
}

export interface UploadedAttachment {
  fileName: string;
  shareLink: string;
}

export interface DeliverRecordDTO {
  id: string;
  productName: string;
  publisher: string;
  developer: string;
  pastProducts: string;
  productNode: string;
  productTypes: string[];
  privacyPolicyUrl: string;
  userAgreementUrl: string;
  testAccounts: TestAccountData[];
  status: 'draft' | 'completed';
  shareCode?: string | null;
  downloadLink?: string | null;
  extractPassword?: string | null;
  pushMessage?: string | null;
  packageFileName?: string | null;
  packageFileSize?: number | null;
  attachments: UploadedAttachment[];
  createdAt: string;
  updatedAt: string;
}

export const defaultDeliverForm: DeliverForm = {
  productName: '',
  publisher: '',
  developer: '',
  pastProducts: '',
  productNode: '',
  productTypes: [],
  privacyPolicyUrl: DEFAULT_PRIVACY_URL,
  userAgreementUrl: DEFAULT_AGREEMENT_URL,
};

export function createTestAccount(): TestAccount {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    account: '',
    password: '',
    server: '',
  };
}

export function formatSavedTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function appendTestAccounts(lines: string[], testAccounts: TestAccountData[]) {
  const valid = testAccounts.filter(a => a.account.trim());
  if (valid.length === 0) return;

  if (valid.length === 1) {
    const a = valid[0];
    lines.push(`测试账号：${a.account.trim()}`);
    if (a.password.trim()) lines.push(`测试密码：${a.password.trim()}`);
    if (a.server.trim()) lines.push(`测试区服：${a.server.trim()}`);
    return;
  }

  lines.push('测试账号：');
  valid.forEach((a, i) => {
    let part = `${i + 1}. 账号：${a.account.trim()}`;
    if (a.password.trim()) part += `  密码：${a.password.trim()}`;
    if (a.server.trim()) part += `  区服：${a.server.trim()}`;
    lines.push(part);
  });
}

export function buildPushMessage(
  form: DeliverForm,
  shareLink: string,
  password?: string | null,
  attachments: UploadedAttachment[] = [],
  testAccounts: TestAccountData[] = [],
): string {
  const types = form.productTypes.length > 0 ? form.productTypes.join(',') : '待定';
  let packageLine = shareLink;
  if (password) {
    packageLine += `\n提取密码：${password}`;
  }

  const lines = [
    `产品名称：${form.productName || '待定'}`,
    `发行商：${form.publisher || '待定'}`,
    `产品研发：${form.developer || '待定'}`,
    `研发过往产品：${form.pastProducts || '待定'}`,
    `产品节点：${form.productNode || '待定'}`,
    `产品类型：${types}`,
    `评测包：${packageLine}`,
  ];

  appendTestAccounts(lines, testAccounts);

  if (form.privacyPolicyUrl.trim()) {
    lines.push(`隐私政策：${form.privacyPolicyUrl.trim()}`);
  }
  if (form.userAgreementUrl.trim()) {
    lines.push(`用户协议：${form.userAgreementUrl.trim()}`);
  }
  if (attachments.length > 0) {
    lines.push('附件：');
    for (const att of attachments) {
      lines.push(`${att.fileName}：${att.shareLink}`);
    }
  }

  return lines.join('\n');
}

export function recordToForm(record: DeliverRecordDTO): DeliverForm {
  return {
    productName: record.productName,
    publisher: record.publisher,
    developer: record.developer,
    pastProducts: record.pastProducts,
    productNode: record.productNode,
    productTypes: record.productTypes,
    privacyPolicyUrl: record.privacyPolicyUrl || DEFAULT_PRIVACY_URL,
    userAgreementUrl: record.userAgreementUrl || DEFAULT_AGREEMENT_URL,
  };
}

export function recordToTestAccounts(record: DeliverRecordDTO): TestAccount[] {
  if (record.testAccounts.length === 0) return [createTestAccount()];
  return record.testAccounts.map(a => ({ ...createTestAccount(), ...a }));
}
