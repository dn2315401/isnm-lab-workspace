import {writeResearchStorage} from './materials/storage-events';
import type { Material, Row } from './formulation-model';

export const batchStatuses = ['작성 중', '합성 예정', '합성 중', '합성 완료', '분석 대기', '완료', '실패', '폐기'] as const;
export type BatchStatus = typeof batchStatuses[number];
export type Ingredient = Row & { plannedRatio?:{amount:string;unit:'wt%'};plannedAmount?: string; purity?: number | null };
export type BatchAttachment = {
  id: string; name: string; type: string; size: number; data: string;
  uploadedAt: string; uploadedBy: string; batchId?: string;
};
export type BatchFields = {
  name: string; type: string; actualDate: string; plannedDate: string; researcher: string;
  composition: string; basis: string; catalyst: string; catalystAmount: string; catalystBasis: string;
  temperature: string; duration: string; solvent: string; wash: string;
  mn: string; pdi: string; tni: string; notes: string;
};
export type BatchDraft = BatchFields & {
  id?: string; revision?: number; status: BatchStatus;
  catalystUsageId?:string;solventUsageId?:string;washUsageIds?:string[];
  catalystUnit?: 'mg' | 'g' | 'kg' | 'wt%'; durationUnit?: 'h' | 'min'; washSolutions?: string[];
  ingredients: Ingredient[]; attachments: BatchAttachment[];
  projectIds: string[]; formulationRef: string; sampleIds: string; analysisRefs: string;
};
type Change = { at: string; by: string; fields: { key: string; before: unknown; after: unknown }[] };
export type Batch = BatchDraft & {
  id: string; revision: number; history: Change[]; createdAt: string; updatedAt: string; example?: boolean;
  compositionParts: { material: string; ratio: number }[];
};

export const batchStorageKey = 'isnm-oligomer-batches-v1';
export const batchTypes = ['CLCE', 'LCE', 'SMP', 'Epoxy', '기타'];
export const researchers = ['김지원', '정유진', '이지원'];

export function blankBatch(): BatchDraft {
  return {
    name: '', type: '', actualDate: '', plannedDate: '', researcher: researchers[0],
    composition: '', basis: 'wt%', catalyst: '', catalystAmount: '', catalystUnit: 'mg', durationUnit: 'h', washSolutions: [''], catalystBasis: '전체 조성',
    temperature: '', duration: '', solvent: '', wash: '', mn: '', pdi: '', tni: '', notes: '',
    status: '합성 중', ingredients: [], attachments: [], projectIds: [], formulationRef: '', sampleIds: '', analysisRefs: '',
  };
}

function example(id: string, name: string, type: string, researcher: string, composition: string,
  mn: string, pdi: string, status: BatchStatus, notes: string): Batch {
  return {
    ...blankBatch(), id, name, type, researcher, composition, mn, pdi, status, notes,
    actualDate: '2026-10-20', example: true, revision: 1, compositionParts: parseComposition(composition),
    history: [], createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
  };
}

const examples = [
  example('OLG-A-023', 'CLCE-EP-1', 'CLCE', '정유진', 'RM82 / CM18', '12400', '1.23', '완료', 'GPC 및 DSC 완료'),
  example('OLG-CLCE-014', 'CLCE-F6', 'CLCE', '이지원', 'RM70 / CM30', '8700', '1.35', '완료', ''),
  example('OLG-SMP-031', 'SMP-PLA', 'SMP', '정유진', 'LA80 / CL20', '15600', '1.28', '분석 대기', 'GPC 측정 예정'),
];

export function readBatches(): Batch[] {
  const data = localStorage.getItem(batchStorageKey);
  if (data === null) return examples;
  const records: unknown = JSON.parse(data);
  if (!Array.isArray(records)) throw new Error('배치 기록 형식을 확인해주세요.');
  return (records as Batch[]).map(batch => ({ ...batch, ...normalizeBatchOptions(batch) }));
}

export function normalizeBatchOptions(batch: BatchDraft) {
  return { catalystUnit: batch.catalystUnit ?? 'wt%' as const, durationUnit: batch.durationUnit ?? 'h' as const,
    washSolutions: batch.washSolutions?.length ? [...batch.washSolutions] : [batch.wash || ''] };
}
export function changeCatalystUnit(value: string, from: NonNullable<BatchDraft['catalystUnit']>, to: NonNullable<BatchDraft['catalystUnit']>) {
  if (!value.trim() || from === to) return value;
  if (from === 'wt%' || to === 'wt%') return '';
  const grams = { mg: .001, g: 1, kg: 1000 };
  return Number.isFinite(Number(value)) ? String(Number((Number(value) * grams[from] / grams[to]).toPrecision(12))) : value;
}
export function changeDurationUnit(value: string, from: NonNullable<BatchDraft['durationUnit']>, to: NonNullable<BatchDraft['durationUnit']>) {
  if (!value.trim() || from === to || !Number.isFinite(Number(value))) return value;
  return String(Number((Number(value) * (from === 'h' ? 60 : 1) / (to === 'h' ? 60 : 1)).toPrecision(12)));
}

export function countBatches(): number {
  try { return readBatches().filter(batch => batch.status !== '작성 중').length; }
  catch { return 0; }
}

export function parseComposition(value: string) {
  return value.split('/').flatMap(part => {
    const match = part.trim().match(/^(.+?)\s*[:=]\s*(\d+(?:\.\d+)?)$|^([^\d]+)(\d+(?:\.\d+)?)$/);
    return match ? [{ material: (match[1] ?? match[3]).trim(), ratio: Number(match[2] ?? match[4]) }] : [];
  });
}

export function validateBatch(draft: BatchDraft, temporary: boolean): string {
  if (!temporary) {
    if (!draft.name.trim()) return '올리고머명을 입력해주세요.';
    if (!draft.type.trim()) return '올리고머 유형을 입력해주세요.';
    if (!(draft.status === '합성 예정' ? draft.plannedDate || draft.actualDate : draft.actualDate)) return '합성일을 입력해주세요.';
    if (!draft.researcher.trim()) return '연구자를 선택해주세요.';
    if (draft.status === '작성 중') return '정식 기록의 상태를 선택하거나 임시저장해주세요.';
  }
  if (!['mg', 'g', 'kg', 'wt%'].includes(draft.catalystUnit ?? 'wt%')) return '촉매 단위를 확인해주세요.';
  if (!['h', 'min'].includes(draft.durationUnit ?? 'h')) return '시간 단위를 확인해주세요.';
  const numericFields = [
    [draft.catalystAmount, '촉매 함량', 0, (draft.catalystUnit ?? 'wt%') === 'wt%' ? 100 : Infinity], [draft.temperature, '반응 온도', 0, 1000],
    [draft.duration, '반응 시간', 0, Infinity], [draft.mn, 'Mn', 0, Infinity],
    [draft.pdi, 'PDI', 0, Infinity], [draft.tni, 'Tni', -273.15, Infinity],
  ] as const;
  for (const [value, label, min, max] of numericFields) {
    if (value && (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max)) {
      return `${label}의 입력 범위를 확인해주세요.`;
    }
  }
  for (const row of draft.ingredients) {
    if (!row.materialId) return `${row.name}의 원료 DB 연결을 확인해주세요.`;
    if ([row.amount, row.plannedAmount].some(value => value && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
      return `${row.name}의 사용량은 0 이상의 숫자로 입력해주세요.`;
    }
  }
  return '';
}

function nextBatchId(records: Batch[], type: string) {
  const prefix = 'OLG-' + (type.trim().toUpperCase().replace(/[^A-Z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || 'DRAFT') + '-';
  const last = records.reduce((max, batch) => batch.id.startsWith(prefix)
    ? Math.max(max, Number(batch.id.slice(prefix.length)) || 0) : max, 0);
  return prefix + String(last + 1).padStart(3, '0');
}

export async function saveBatch(draft: BatchDraft, temporary: boolean) {
  const error = validateBatch(draft, temporary);
  if (error) throw new Error(error);
  const persist = () => {
    const records = readBatches();
    const prior = records.find(batch => batch.id === draft.id);
    if (draft.id && prior?.revision !== draft.revision) throw new Error('다른 탭에서 이 배치를 수정했습니다. 입력 내용을 보관한 뒤 최신 기록을 다시 열어주세요.');
    const at = new Date().toISOString();
    const id = prior?.id ?? nextBatchId(records, draft.type);
    const { id: _id, revision: _revision, ...fields } = draft;
    const values = {
      ...fields, ...normalizeBatchOptions(draft), wash: (draft.washSolutions ?? [draft.wash]).map(value => value.trim()).filter(Boolean).join(' / '), name: fields.name.trim(), type: fields.type.trim(),
      status: temporary ? '작성 중' as const : fields.status,
      attachments: fields.attachments.map(file => ({ ...file, batchId: id })),
    };
    const summarize = (key: string, value: unknown) => key === 'attachments'
      ? (value as BatchAttachment[]).map(({ data, ...meta }) => meta) : value;
    const changes = prior ? Object.entries(values).flatMap(([key, value]) => {
      const before = summarize(key, prior[key as keyof BatchDraft]);
      const after = summarize(key, value);
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ key, before, after }];
    }) : [];
    const batch: Batch = {
      ...values, id, revision: (prior?.revision ?? 0) + 1, example: prior?.example,
      createdAt: prior?.createdAt ?? at, updatedAt: at, compositionParts: parseComposition(draft.composition),
      history: [...(prior?.history ?? []), ...(changes.length ? [{ at, by: draft.researcher, fields: changes }] : [])],
    };
    const next = prior ? records.map(record => record.id === id ? batch : record) : [batch, ...records];
    writeResearchStorage(batchStorageKey, JSON.stringify(next));
    return { batch, records: next };
  };
  return navigator.locks ? navigator.locks.request(batchStorageKey, persist) : persist();
}

/** Completed outputs are explicitly registered in the shared material DB, never synthesized as virtual materials. */
export function withOligomerBatches(materials:Material[]):Material[]{return materials;}
