import {isMaterialDate} from './material-dates';
import catalog from './material-catalog.json';
import { library, type Material, type Unit } from './formulation-model';

export const materialKey = 'isnm-material-library-v1';
export const lifecycle = ['Active', 'Completed', 'Expired', 'Archived', 'Disposed'] as const;
export type Lifecycle = typeof lifecycle[number];
export const lifecycleLabels: Record<Lifecycle,string> = { Active: '사용 중', Completed: '사용 완료', Expired: '유효기간 만료', Archived: '보관 중', Disposed: '폐기' };
export const lifecycleLabel = (value: string) => lifecycleLabels[value as Lifecycle] ?? (value === 'Depleted' ? '보관 중' : value);
const notesCleanupKey = 'isnm-material-notes-cleared-2026-11-23';
export type InventoryFields = {
  productNumber?:string; supplier?:string; received?:string; expires?:string; completedDate?:string; disposedDate?:string; statusReason?:string; statusDate?:string;
  manufacturer: string; location: string; capacity: string; remaining: string; state: string;
  purchased: string; opened: string; unopened: boolean; notes: string; viscosity: string;
  measurementTemperature: string; measurementConditions: string; phase: string; phaseValue: string; purity: string;
  lifecycle: Lifecycle; msds?: { id: string; name: string; size: number; data: string; uploadedAt: string; uploadedBy: string };
};
export type TestAvailability={status:string;basis:'development-test';run:string};
export type InventoryLot = Material['lots'][number] & {
  testActivation?:{basis:string;run:string;previousStatus:string};
  reagentId?:string; internalCode?:string; manufacturingLot?:string; sourceKind?:'purchased'|'synthesized'|'legacy'; reviewRequired?:boolean; orderId?:string;
  inventory?: InventoryFields; unit?: Unit; purity?: number | null; revision?: number; example?: boolean;
  history?: { date: string; changes: string[] }[];
};
export type InventoryMaterial = Omit<Material, 'lots'> & { testAvailability?:TestAvailability; revision?: number; cas?: string; chemicalName?: string; formula?: string; reference?: { category: string; molecularWeightDescription: string; densityDescription: string; usage: string; meltingPoint?: string; boilingPoint?: string; phaseTransitions?: string; notes?: string }; lots: InventoryLot[]; example?: boolean };
export type MaterialDraft = InventoryFields & {
  materialRevision?:number;groupsText?:string;chemicalName?:string;materialId: string; lotId: string; revision: number; name: string; lot: string; cas: string; unit: Unit;
  component: string; mw: string; density: string; functionality: string;
};
export const materialDraftKey = 'isnm-material-draft-v1';
export const states = ['powder', 'pellets', 'beads', 'pure liquid', 'solution'];
export const companies = ['TCI', 'Sigma-Aldrich', 'Duksan'];
export const locations = ['냉동실', '냉장고', '용매 시약장', '산염기 시약장', '상온 시약장 좌측', '상온 시약장 우측'];
export const phases = ['융점', '끓는점', '유리전이온도', '기타'];

const blankInventory = (): InventoryFields => ({
  manufacturer: '', location: '', capacity: '', remaining: '', state: '', purchased: '', opened: '',
  unopened: true, notes: '', viscosity: '', measurementTemperature: '', measurementConditions: '',
  phase: '', phaseValue: '', purity: '', lifecycle: 'Active',
});

export function makeMaterialDraft(material?: InventoryMaterial, lot?: InventoryLot): MaterialDraft {
  return {
    ...blankInventory(), ...lot?.inventory, materialId: material?.id ?? '', lotId: lot?.id ?? '',
    revision: lot?.revision ?? 0, materialRevision:material?.revision, groupsText:material?.groups?.map(g=>g.type+':'+g.count).join('\n')||'', chemicalName:material?.chemicalName||'', name: material?.name ?? '', lot: lot?.name ?? '', cas: material?.cas ?? '',
    unit: lot?.unit ?? material?.unit ?? 'g', component: material?.component ?? 'Other',
    mw: String((lot?.mw !== undefined ? lot.mw : material?.mw) ?? ''),
    density: String((lot?.density !== undefined ? lot.density : material?.density) ?? ''),
    functionality: String(material?.functionality ?? ''),
    lifecycle: (lot?.inventory?.lifecycle as string) === 'Depleted' ? 'Archived' : lot?.inventory?.lifecycle ?? 'Active',
  };
}

export const catalogMaterials: InventoryMaterial[] = (catalog as unknown as InventoryMaterial[]).map(material => ({
  ...material, lots: material.lots.map(lot => ({ ...lot, inventory: { ...blankInventory(), unopened: false,
    notes: '' } })),
}));

export function mergeMaterialCatalog(existing: InventoryMaterial[]): InventoryMaterial[] {
  // Retain edited legacy lots and all user-created records; hide untouched demo stock.
  const records = existing.flatMap(material => {
    const legacy = material.example ?? library.some(item => item.id === material.id);
    if (!legacy) return [material];
    const lots = material.lots.filter(lot => lot.example === false || (lot.revision ?? 0) > 0 || (lot.history?.length ?? 0) > 0);
    return lots.length ? [{ ...material, lots }] : [];
  });
  for (const item of catalogMaterials) {
    const index = records.findIndex(record => record.id === item.id || record.name.trim().toLowerCase() === item.name.toLowerCase());
    if (index < 0) records.push(item);
    else {
      const old = records[index];
      records[index] = { ...item, ...old, chemicalName: old.chemicalName ?? item.chemicalName,
        formula: old.formula ?? item.formula, reference: old.reference ?? item.reference };
    }
  }
  return records;
}

export function readInventory(): InventoryMaterial[] {
  const raw = localStorage.getItem(materialKey);
  const parsed: unknown = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('원료 라이브러리 형식을 확인해주세요.');
  // The shared DB migration must not perform the retired one-time note cleanup.
  const records = mergeMaterialCatalog(parsed).map(material=>({...material,lots:material.lots.map(lot=>(lot.inventory?.lifecycle as string)==='Depleted'?{...lot,inventory:{...lot.inventory!,lifecycle:'Archived' as const}}:lot)}));
  return records;
}

export function readInventorySafely() {
  try { return readInventory(); }
  catch { return []; }
}

export function availableMaterials(materials: InventoryMaterial[], includeExamples = true) {
  return materials.map(material => ({
    ...material, lots: material.lots.filter(lot => (!lot.inventory || lot.inventory.lifecycle === 'Active')
      && (includeExamples || !(lot.example ?? material.example ?? library.some(item => item.id === material.id)))),
  })).filter(material => material.lots.length > 0);
}

const normalized = (value: string) => value.trim().toLowerCase();
const numeric = (value: string) => value.trim() ? Number(value) : null;
const amountText = (value: string, unit: Unit) => value === '' ? '' : value + ' ' + unit;

export function validateMaterial(draft: MaterialDraft, temporary: boolean) {
  const errors: Partial<Record<keyof MaterialDraft, string>> = {};
  if (!lifecycle.includes(draft.lifecycle)) errors.lifecycle = '재고 상태를 다시 선택해주세요.';
  const required = { name: '물질명', capacity: '용량', state: '상태', location: '보관 위치' } as const;
  if (!temporary) for (const key of Object.keys(required) as (keyof typeof required)[]) {
    if (!draft[key].trim()) errors[key] = required[key] + '을(를) 입력해주세요.';
  }
  if (draft.cas.trim() && !/^\d{2,7}-\d{2}-\d$/.test(draft.cas.trim())) errors.cas = 'CAS 번호 형식을 확인해주세요.';
  for (const key of ['capacity', 'remaining', 'mw', 'density', 'viscosity', 'measurementTemperature', 'phaseValue', 'purity', 'functionality'] as const) {
    const value = numeric(draft[key]);
    const min = key === 'measurementTemperature' || key === 'phaseValue' ? -273.15 : 0;
    if (value !== null && (!Number.isFinite(value) || value < min || (key === 'purity' && value > 100)
      || (key === 'functionality' && !Number.isInteger(value)) || ((key === 'mw' || key === 'density') && value === 0))) {
      errors[key] = '유효한 숫자 범위를 입력해주세요.';
    }
  }
  if (draft.phaseValue.trim() && !draft.phase) errors.phase = '상변화 유형을 선택해주세요.';
  for (const key of ['purchased', 'opened'] as const) {
    if (key === 'opened' && draft.unopened) continue;
    if (draft[key] && !isMaterialDate(draft[key])) errors[key] = '날짜를 YYYYMMDD 형식의 8자리로 입력해주세요. 실제로 존재하는 날짜여야 합니다.';
  }
  if (!draft.unopened && !temporary && !draft.opened) errors.opened = '개봉일을 입력해주세요.';
  if (!draft.unopened && draft.opened && draft.purchased && draft.opened < draft.purchased) errors.opened = '개봉일은 구매일 이후여야 합니다.';
  if (draft.remaining.trim() && draft.capacity.trim() && Number(draft.remaining) > Number(draft.capacity)) errors.remaining = '잔량은 용량 이하여야 합니다.';
  return errors;
}

/** Legacy local-only persistence is retired. All UI registrations use saveSharedMaterial. */
export function saveMaterial(_draft: MaterialDraft):never {throw new Error('공용 원료 DB 저장 기능을 사용해주세요.');}
