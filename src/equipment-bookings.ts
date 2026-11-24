export type Equipment = {
  id: string; name: string; description: string; icon: string; manual: string; reservable: boolean;
  opens: string; closes: string; step: number; maximum: number; advance: number;
  englishName?: string; manufacturer?: string; model?: string; category?: string; location?: string;
  custodian?: string; managementNumber?: string; specs?: string[]; aliasIds?: string[];
};
export type Condition = '미확인' | '정상' | '이상 있음';
export type Booking = {
  id: number | string; name: string; date: string; time: string; person: string; equipmentId?: string;
  end?: string; owner?: string; mode?: string; condition?: Condition; memo?: string; cancelled?: boolean;
  projectId?: string; sampleId?: string; analysisRef?: string; revision?: number;
  outputRange?: 'range1' | 'range2'; plannedVoltage?: string; plannedCurrent?: string;
};
export type Maintenance = { id: string; equipmentId: string; date: string; start: string; end: string; note: string };
export const currentResearcher = '김지원';
export const bookingKey = 'isnm-bookings';
export const equipmentKey = 'isnm-equipment-v1';
export const maintenanceKey = 'isnm-equipment-maintenance-v1';
export const dp811a: Equipment = {
  id: 'dp811a', name: 'DC 전원공급장치', englishName: 'DC Power Supply', manufacturer: 'RIGOL', model: 'DP811A',
  category: '전기·전자 실험 장비', description: 'LCE 필름 전열 및 전기 구동 실험', icon: 'power',
  location: '', custodian: '', managementNumber: '',
  specs: ['단일 채널 · 2개 출력 Range', 'Range 1: 20 V / 10 A', 'Range 2: 40 V / 5 A', '최대 출력 200 W'],
  manual: '', reservable: true, opens: '09:00', closes: '18:00', step: 30, maximum: 240, advance: 60,
};
export function isDp811a(equipment: Pick<Equipment,'id'|'name'> & Partial<Equipment>) {
  return equipment.id.toLowerCase() === 'dp811a' || /\bdp811a\b/i.test([equipment.model, equipment.name, equipment.englishName].filter(Boolean).join(' '));
}
export const defaults: Equipment[] = [
  ['dma', 'DMA', '동적 기계 분석', 'dma', 30, 360],
  ['microscope', '현미경', '시료 관찰', 'microscope', 60, 180],
  ['synthesis', '올리고머 합성 장비', '올리고머 합성', 'synthesis', 30, 480],
  ['thermal', '열화상 카메라', '온도 분포 측정', 'thermal', 30, 240],
].map(([id, name, description, icon, step, maximum]) => ({
  id: String(id), name: String(name), description: String(description), icon: String(icon),
  step: Number(step), maximum: Number(maximum), manual: '', reservable: true, opens: '09:00', closes: '18:00', advance: 60,
})).concat(dp811a);
export const initialBookings: Booking[] = [
  { id: 1, name: 'DMA', date: '2026-11-13', time: '14:00', person: '김지원' },
  { id: 2, name: 'DSC', date: '2026-11-13', time: '16:00', person: '이유진' },
];
/** Merge the new device into existing catalogs without replacing saved IDs or settings. */
export function mergeEquipment(items: Equipment[]): Equipment[] {
  const output: Equipment[] = [];
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') throw new Error('저장된 장비 정보를 확인해주세요.');
    const existing = output.find(e => e.id === item.id || isDp811a(e) && isDp811a(item));
    if (existing) {
      // Preserve aliases so bookings made with a duplicated old ID can still be found.
      existing.aliasIds = [...new Set([...(existing.aliasIds || []), ...(item.aliasIds || []), ...(existing.id !== item.id ? [item.id] : [])])];
      continue;
    }
    output.push(isDp811a(item) ? {...dp811a, ...item, aliasIds: [...(item.aliasIds || [])]} : {...item});
  }
  if (!output.some(isDp811a)) output.push({...dp811a});
  return output;
}
export function readEquipment(storage: Pick<Storage,'getItem'> = localStorage): Equipment[] {
  const items: unknown = JSON.parse(storage.getItem(equipmentKey) ?? 'null') ?? defaults;
  if (!Array.isArray(items)) throw new Error('저장된 장비 목록을 읽지 못했습니다.');
  return mergeEquipment(items as Equipment[]);
}
export function readList<T>(key: string, fallback: T[]): T[] {
  if (key === equipmentKey) return readEquipment() as T[];
  const items: unknown = JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  if (!Array.isArray(items)) throw new Error('저장된 목록을 읽지 못했습니다.');
  return items as T[];
}
export const powerRanges = {
  range1: {label: 'Range 1 · 20 V / 10 A', voltage: 20, current: 10},
  range2: {label: 'Range 2 · 40 V / 5 A', voltage: 40, current: 5},
} as const;
export function powerSettingsError({outputRange, voltage = '', current = ''}: {outputRange?: Booking['outputRange']; voltage?: string; current?: string}): string {
  const hasVoltage = String(voltage).trim() !== '', hasCurrent = String(current).trim() !== '';
  if (!outputRange && !hasVoltage && !hasCurrent) return '';
  if (!outputRange || !(outputRange in powerRanges)) return '전압·전류를 입력하려면 출력 Range를 선택해주세요.';
  const range = powerRanges[outputRange];
  for (const [label, value, present, maximum, unit] of [['전압',voltage,hasVoltage,range.voltage,'V'],['전류',current,hasCurrent,range.current,'A']] as const) {
    if (present && (!Number.isFinite(Number(value)) || Number(value) < 0)) return `${label}은 0 이상의 유효한 숫자로 입력해주세요.`;
    if (present && Number(value) > maximum) return `선택한 ${range.label}의 ${label} 한도는 ${maximum} ${unit}입니다.`;
  }
  if (hasVoltage && hasCurrent && Number(voltage) * Number(current) > 200) return '계획 전압 × 전류는 최대 출력 200 W를 넘을 수 없습니다.';
  return '';
}

export function dateKey(date = new Date()) {
  return date.toLocaleDateString('sv-SE');
}
export function minutes(time: string) {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}
export function clock(value: number) {
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}
export function endOf(booking: Booking) {
  return booking.end || clock(minutes(booking.time) + 60);
}
export function forEquipment(booking: Booking, equipment: Equipment) {
  return booking.equipmentId ? booking.equipmentId === equipment.id || !!equipment.aliasIds?.includes(booking.equipmentId) : booking.name === equipment.name;
}
export function ownsBooking(booking: Booking) {
  return (booking.owner ?? booking.person) === currentResearcher;
}
export function reservationError(booking: Booking, equipment: Equipment, reservations: Booking[], maintenance: Maintenance[], now = new Date()) {
  if (!equipment.reservable) return '현재 예약할 수 없는 장비입니다.';
  if (isDp811a(equipment)) { const powerError = powerSettingsError({outputRange:booking.outputRange,voltage:booking.plannedVoltage,current:booking.plannedCurrent}); if (powerError) return powerError; }
  const today = dateKey(now);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + equipment.advance);
  if (booking.date < today || booking.date > dateKey(limit)) return '예약 가능 기간을 확인해주세요.';
  const start = minutes(booking.time), end = minutes(booking.end ?? '');
  const opens = minutes(equipment.opens), closes = minutes(equipment.closes);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return '종료 시간은 시작 시간 이후로 선택해주세요.';
  if (booking.date === today && start <= now.getHours() * 60 + now.getMinutes()) return '이미 지난 시간은 예약할 수 없습니다.';
  if (start < opens || end > closes) return `운영 시간은 ${equipment.opens}–${equipment.closes}입니다.`;
  if ((start - opens) % equipment.step || (end - opens) % equipment.step) return `${equipment.step}분 단위로 선택해주세요.`;
  if (end - start > equipment.maximum) return `최대 ${equipment.maximum}분까지 예약할 수 있습니다.`;
  const overlaps = (from: string, to: string) => start < minutes(to) && end > minutes(from);
  if (maintenance.some(item => (item.equipmentId === equipment.id || equipment.aliasIds?.includes(item.equipmentId)) && item.date === booking.date && overlaps(item.start, item.end))) return '장비 점검 시간과 겹칩니다.';
  if (reservations.some(item => item.id !== booking.id && !item.cancelled && forEquipment(item, equipment)
    && item.date === booking.date && overlaps(item.time, endOf(item)))) return '기존 예약과 시간이 겹칩니다.';
  if (!booking.mode?.trim()) return '측정 모드를 입력해주세요.';
  return '';
}

export async function writeSchedule<T>(action: () => T) {
  return navigator.locks ? navigator.locks.request('isnm-equipment-schedule', action) : action();
}
