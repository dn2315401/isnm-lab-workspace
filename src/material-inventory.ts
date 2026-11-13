import { library, type Material, type Unit } from './formulation-model';

export const materialKey = 'isnm-material-library-v1';
export const lifecycle = ['Active', 'Depleted', 'Expired', 'Archived', 'Disposed'] as const;
export type Lifecycle = typeof lifecycle[number];
export type InventoryFields = {
  manufacturer: string; location: string; capacity: string; remaining: string; state: string;
  purchased: string; opened: string; unopened: boolean; notes: string; viscosity: string;
  measurementTemperature: string; measurementConditions: string; phase: string; phaseValue: string; purity: string;
  lifecycle: Lifecycle; msds?: { id: string; name: string; size: number; data: string; uploadedAt: string; uploadedBy: string };
};
export type InventoryLot = Material['lots'][number] & {
  inventory?: InventoryFields; unit?: Unit; purity?: number | null; revision?: number; example?: boolean;
  history?: { date: string; changes: string[] }[];
};
export type InventoryMaterial = Omit<Material, 'lots'> & { cas?: string; lots: InventoryLot[]; example?: boolean };
export type MaterialDraft = InventoryFields & {
  materialId: string; lotId: string; revision: number; name: string; lot: string; cas: string; unit: Unit;
  component: string; mw: string; density: string; functionality: string;
};
export const materialDraftKey = 'isnm-material-draft-v1';
export const states = ['powder', 'pellets', 'beads', 'pure liquid', 'solution'];
export const companies = ['TCI', 'Sigma-Aldrich', 'Duksan'];
export const locations = ['시약장 A-02', '시약장 B-01', '용매장 S-01'];
export const phases = ['융점', '끓는점', '유리전이온도', '기타'];

const blankInventory = (): InventoryFields => ({
  manufacturer: '', location: '', capacity: '', remaining: '', state: '', purchased: '', opened: '',
  unopened: true, notes: '', viscosity: '', measurementTemperature: '', measurementConditions: '',
  phase: '', phaseValue: '', purity: '', lifecycle: 'Active',
});

export function makeMaterialDraft(material?: InventoryMaterial, lot?: InventoryLot): MaterialDraft {
  return {
    ...blankInventory(), ...lot?.inventory, materialId: material?.id ?? '', lotId: lot?.id ?? '',
    revision: lot?.revision ?? 0, name: material?.name ?? '', lot: lot?.name ?? '', cas: material?.cas ?? '',
    unit: lot?.unit ?? material?.unit ?? 'g', component: material?.component ?? 'Other',
    mw: String((lot?.mw !== undefined ? lot.mw : material?.mw) ?? ''),
    density: String((lot?.density !== undefined ? lot.density : material?.density) ?? ''),
    functionality: String(material?.functionality ?? ''),
  };
}

const demoDetails: Record<string, { manufacturer: string; location: string; capacity: string; state: string }> = {
  rm82: { manufacturer: 'TCI', location: '시약장 A-02', capacity: '25', state: 'powder' },
  thf: { manufacturer: 'Duksan', location: '용매장 S-01', capacity: '1000', state: 'pure liquid' },
};
const defaults: InventoryMaterial[] = library.map(material => ({
  ...material, example: true, lots: material.lots.map(lot => ({
    ...lot, inventory: { ...blankInventory(), ...demoDetails[material.id] },
    ...(material.id === 'thf' ? { unit: 'mL' as const } : {}),
  })),
}));

export function readInventory(): InventoryMaterial[] {
  const raw = localStorage.getItem(materialKey);
  if (raw === null) return defaults;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('원료 라이브러리 형식을 확인해주세요.');
  return parsed.map((material: InventoryMaterial) => ({
    ...material, example: material.example ?? library.some(item => item.id === material.id),
  }));
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
  if (!draft.unopened && !temporary && !draft.opened) errors.opened = '개봉일을 입력해주세요.';
  if (!draft.unopened && draft.opened && draft.purchased && draft.opened < draft.purchased) errors.opened = '개봉일은 구매일 이후여야 합니다.';
  if (draft.remaining.trim() && draft.capacity.trim() && Number(draft.remaining) > Number(draft.capacity)) errors.remaining = '잔량은 용량 이하여야 합니다.';
  return errors;
}

export function saveMaterial(draft: MaterialDraft) {
  const records = readInventory();
  const existing = records.find(record => record.id === draft.materialId)
    ?? (!draft.materialId ? records.find(record => normalized(record.name) === normalized(draft.name)
      && normalized(record.cas ?? '') === normalized(draft.cas)) : undefined);
  if (draft.materialId && !existing) throw new Error('연결할 물질을 다시 선택해주세요.');
  const previous = existing?.lots.find(lot => lot.id === draft.lotId);
  if (draft.lotId && (!previous || (previous.revision ?? 0) !== draft.revision)) throw new Error('최신 Lot 기록을 다시 열어주세요.');
  if (draft.lot.trim() && existing?.lots.some(lot => lot.id !== draft.lotId
    && normalized(lot.name) === normalized(draft.lot) && normalized(lot.inventory?.manufacturer ?? '') === normalized(draft.manufacturer))) {
    throw new Error('이 물질과 회사에 같은 Lot 번호가 이미 등록되어 있습니다.');
  }
  const { materialId, lotId, revision, name, lot, cas, unit, component, mw, density, functionality, ...details } = draft;
  const inventory = { ...details, opened: draft.unopened ? '' : draft.opened,
    manufacturer: draft.manufacturer.trim(), location: draft.location.trim(), state: draft.state.trim() };
  if (inventory.lifecycle === 'Active' && numeric(inventory.remaining) === 0) inventory.lifecycle = 'Depleted';
  const nextLot: InventoryLot = {
    ...previous, id: lotId || crypto.randomUUID(), name: lot.trim() || 'Lot 미등록', unit,
    example: previous ? previous.example ?? existing?.example ?? false : false,
    stock: amountText(inventory.remaining || inventory.capacity, unit) || '재고 미등록',
    mw: numeric(mw), density: numeric(density), purity: numeric(inventory.purity), revision: revision + 1, inventory,
  };
  const old = previous && existing ? makeMaterialDraft(existing, previous) : null;
  const changes = old ? Object.entries(draft).flatMap(([key, value]) => {
    const before = old[key as keyof MaterialDraft];
    if (key === 'msds') {
      return old.msds?.id === draft.msds?.id ? [] : ['MSDS: ' + (old.msds?.name ?? '—') + ' → ' + (draft.msds?.name ?? '—')];
    }
    return before === value ? [] : [key + ': ' + String(before || '—') + ' → ' + String(value || '—')];
  }) : ['Lot 등록'];
  nextLot.history = [...(previous?.history ?? []), ...(changes.length ? [{ date: new Date().toISOString(), changes }] : [])];
  const nextMaterial: InventoryMaterial = {
    ...(existing ?? { id: crypto.randomUUID(), unit, role: '기타', mw: numeric(mw), density: numeric(density) }),
    name: name.trim(), cas: cas.trim(), component, functionality: numeric(functionality),
    lots: previous ? existing!.lots.map(item => item.id === previous.id ? nextLot : item) : [...(existing?.lots ?? []), nextLot],
  };
  const next = existing ? records.map(record => record.id === existing.id ? nextMaterial : record) : [nextMaterial, ...records];
  localStorage.setItem(materialKey, JSON.stringify(next));
  return { records: next, lotId: nextLot.id };
}
