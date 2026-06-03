import type { DeliverForm, DeliverRecordDTO, TestAccountData, UploadedAttachment } from './deliver-types';

export interface SaveDeliverPayload {
  id?: string | null;
  status: 'draft' | 'completed';
  form: DeliverForm;
  testAccounts: TestAccountData[];
  shareCode?: string | null;
  downloadLink?: string | null;
  extractPassword?: string | null;
  pushMessage?: string | null;
  packageFileName?: string | null;
  packageFileSize?: number | null;
  attachments?: UploadedAttachment[];
}

function parseRecord(raw: Record<string, unknown>): DeliverRecordDTO {
  return {
    id: String(raw.id),
    productName: String(raw.productName || ''),
    publisher: String(raw.publisher || ''),
    developer: String(raw.developer || ''),
    pastProducts: String(raw.pastProducts || ''),
    productNode: String(raw.productNode || ''),
    productTypes: Array.isArray(raw.productTypes) ? raw.productTypes as string[] : [],
    privacyPolicyUrl: String(raw.privacyPolicyUrl || ''),
    userAgreementUrl: String(raw.userAgreementUrl || ''),
    testAccounts: Array.isArray(raw.testAccounts) ? raw.testAccounts as TestAccountData[] : [],
    status: raw.status === 'completed' ? 'completed' : 'draft',
    shareCode: raw.shareCode ? String(raw.shareCode) : null,
    downloadLink: raw.downloadLink ? String(raw.downloadLink) : null,
    extractPassword: raw.extractPassword ? String(raw.extractPassword) : null,
    pushMessage: raw.pushMessage ? String(raw.pushMessage) : null,
    packageFileName: raw.packageFileName ? String(raw.packageFileName) : null,
    packageFileSize: typeof raw.packageFileSize === 'number' ? raw.packageFileSize : null,
    attachments: Array.isArray(raw.attachments) ? raw.attachments as UploadedAttachment[] : [],
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  };
}

export async function fetchDeliverRecords(): Promise<DeliverRecordDTO[]> {
  const res = await fetch('/api/deliver');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '加载失败');
  return (data.records || []).map(parseRecord);
}

export async function fetchDeliverRecord(id: string): Promise<DeliverRecordDTO> {
  const res = await fetch(`/api/deliver/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '加载失败');
  return parseRecord(data.record);
}

export async function saveDeliverRecord(payload: SaveDeliverPayload): Promise<DeliverRecordDTO> {
  const res = await fetch('/api/deliver', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '保存失败');
  return parseRecord(data.record);
}

export async function deleteDeliverRecord(id: string): Promise<void> {
  const res = await fetch(`/api/deliver/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '删除失败');
}
