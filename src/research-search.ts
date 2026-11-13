import { readInventory, makeMaterialDraft } from './material-inventory';
import { readBatches, type Batch } from './oligomer-batches';
import type { Saved, Row } from './formulation-model';
import type { ResearchStore } from './calculator-model';

export const kinds = ['프로젝트', '올리고머 배치', '조성 정보', '합성 기록', '원료', '원료 Lot', '샘플', '분석 결과'] as const;
export type Kind = typeof kinds[number];
export type SearchProject = { id: number; name: string; description: string; category: string; progress: number };
export type Result = {
  key: string; id: string; name: string; kind: Kind; projects: string[]; researcher?: string;
  date?: string; status?: string; analysisStatus?: string; summary?: string; source: string;
  terms?: string[]; fields: [string, string][]; rows?: Row[]; batch?: Batch; example?: boolean;
};
export const materialLink = (id: string) => '#materials/' + encodeURIComponent(id);
const projectLink = (id: string) => '#project/' + encodeURIComponent(id);
const batchLink = (id: string) => '#oligomer-batches/' + encodeURIComponent(id);
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().trim();
const rowTerms = (rows: Row[]) => rows.flatMap(row => [row.name, row.lot, row.materialId, row.lotId]);

export function buildSearch(projects: SearchProject[]) {
  const results: Result[] = [];
  const warnings: string[] = [];
  function read<T>(name: string, source: () => T, fallback: T): T {
    try { return source(); }
    catch { warnings.push(name); return fallback; }
  }
  const batches = read('올리고머 배치', readBatches, []);
  const materials = read('원료물질', readInventory, []);
  const formulations = read<Saved[]>('조성 정보', () => JSON.parse(localStorage.getItem('isnm-formulations') ?? '[]'), []);
  const research = read<ResearchStore>('합성·샘플', () => JSON.parse(localStorage.getItem('isnm-research-v1') ?? 'null')
    ?? { syntheses: [], samples: [], calculations: [] }, { syntheses: [], samples: [], calculations: [] });
  const projectName = (id: string) => projects.find(project => String(project.id) === id)?.name ?? id;
  const add = (result: Omit<Result, 'key'>) => results.push({ ...result, key: result.kind + ':' + result.id });
  const materialProjects = new Map<string, Set<string>>();
  for (const record of [...formulations.map(record => ({ rows: record.rows, ids: [record.projectId] })),
    ...research.syntheses.map(record => ({ rows: record.input.rows, ids: [record.projectId] })),
    ...batches.map(batch => ({ rows: batch.ingredients, ids: batch.projectIds }))]) {
    for (const row of record.rows) {
      for (const id of [row.materialId, row.lotId]) {
        const linked = materialProjects.get(id) ?? new Set<string>();
        record.ids.filter(Boolean).forEach(project => linked.add(project));
        materialProjects.set(id, linked);
      }
    }
  }
  for (const project of projects) {
    const id = String(project.id);
    add({ id: 'PRJ-' + id.padStart(3, '0'), name: project.name, kind: '프로젝트', projects: [id],
      source: projectLink(id), summary: project.description, terms: [project.category],
      fields: [['분류', project.category], ['진행률', project.progress + '%'], ['설명', project.description]] });
  }
  for (const batch of batches) {
    const analysisStatus = batch.status === '완료' ? '분석 완료' : batch.status === '실패' ? '실패'
      : batch.status === '분석 대기' || batch.status === '합성 완료' ? '분석 대기' : '분석 전';
    const common = { projects: batch.projectIds, researcher: batch.researcher, source: batchLink(batch.id), batch, example: batch.example };
    add({ ...common, id: batch.id, name: batch.name || '이름 미등록', kind: '올리고머 배치',
      date: batch.actualDate || batch.plannedDate, status: batch.status, analysisStatus, summary: batch.composition,
      terms: [batch.type, batch.notes, batch.catalyst, batch.solvent, batch.sampleIds, batch.analysisRefs, ...rowTerms(batch.ingredients)],
      fields: [['올리고머 유형', batch.type], ['연구자', batch.researcher], ['합성일', batch.actualDate], ['예정일', batch.plannedDate], ['비고', batch.notes]] });
    for (const ref of batch.analysisRefs.split(/[,\n]+/).map(value => value.trim()).filter(Boolean).filter((value, index, list) => list.indexOf(value) === index)) {
      add({ ...common, id: ref + ' · ' + batch.id, name: ref, kind: '분석 결과', analysisStatus, status: analysisStatus,
        terms: [ref, batch.id, batch.name, batch.sampleIds], summary: '배치에 등록된 분석 참조',
        fields: [['분석 기록 ID', ref], ['Batch ID', batch.id], ['샘플 ID', batch.sampleIds]] });
    }
  }
  for (const material of materials) {
    const source = material.lots[0] ? materialLink(material.lots[0].id) : '#materials';
    add({ id: material.id, name: material.name, kind: '원료', source, example: material.example,
      projects: [...(materialProjects.get(material.id) ?? [])], summary: material.cas,
      terms: [material.component, ...material.lots.flatMap(lot => [lot.name, lot.inventory?.manufacturer ?? ''])],
      fields: [['CAS 번호', material.cas ?? ''], ['분류', material.component], ['등록 Lot', material.lots.map(lot => lot.name).join(', ')]] });
    for (const lot of material.lots) {
      const values = makeMaterialDraft(material, lot);
      add({ id: lot.id, name: material.name + ' · ' + lot.name, kind: '원료 Lot', source: materialLink(lot.id),
        projects: [...(materialProjects.get(lot.id) ?? [])], date: values.purchased, status: values.lifecycle, example: lot.example ?? material.example,
        summary: [values.manufacturer, values.location].filter(Boolean).join(' · '),
        terms: [lot.name, material.cas ?? '', values.notes, values.state],
        fields: [['Lot 번호', lot.name], ['CAS 번호', values.cas], ['회사명', values.manufacturer], ['위치', values.location],
          ['잔량', values.remaining ? values.remaining + ' ' + values.unit : ''], ['MSDS', values.msds?.name ?? '']] });
    }
  }
  for (const record of formulations) add({
    id: record.id + ':v' + record.version, name: record.name, kind: '조성 정보', projects: [record.projectId],
    researcher: (record as Saved & { author?: string }).author, date: record.savedAt, source: '#formulation', rows: record.rows,
    summary: 'v' + record.version, terms: [record.synthesisId, ...record.sampleIds, ...record.analysisRefs, ...rowTerms(record.rows)],
    fields: [['조성 버전', String(record.version)], ['저장일', record.savedAt.slice(0, 10)], ['샘플 ID', record.sampleIds.join(', ')]],
  });
  for (const record of research.syntheses) {
    const author = research.calculations.find(item => item.id === record.calculationId)?.author;
    add({ id: record.id, name: record.input.name || record.id, kind: '합성 기록', projects: [record.projectId],
      date: record.performedDate || record.plannedDate || record.createdAt, researcher: author, status: record.status,
      source: projectLink(record.projectId) + '/' + encodeURIComponent(record.id), rows: record.input.rows,
      summary: record.conditions, terms: [record.memo, record.formulationId, ...record.sampleIds, ...rowTerms(record.input.rows)],
      fields: [['합성 조건', record.conditions], ['비고', record.memo], ['샘플 ID', record.sampleIds.join(', ')]] });
  }
  for (const sample of research.samples) {
    const synthesis = research.syntheses.find(record => record.id === sample.synthesisId);
    const source = projectLink(sample.projectId) + '/' + encodeURIComponent(sample.synthesisId);
    const analysisStatus = sample.analysis?.trim() ? undefined : '분석 전';
    add({ id: sample.id, name: sample.name || sample.id, kind: '샘플', projects: [sample.projectId], source,
      date: synthesis?.performedDate || synthesis?.createdAt, status: sample.status, analysisStatus, summary: sample.shape,
      terms: [sample.synthesisId, sample.formulationId, sample.notes, sample.analysis],
      fields: [['합성 기록', sample.synthesisId], ['형태', sample.shape], ['비고', sample.notes], ['분석 참조', sample.analysis]] });
    if (sample.analysis?.trim()) add({ id: sample.id, name: sample.analysis, kind: '분석 결과', projects: [sample.projectId], source,
      summary: '샘플에 등록된 분석 참조', fields: [['샘플 ID', sample.id], ['분석 참조', sample.analysis]], terms: [sample.name, sample.synthesisId] });
  }
  return { warnings, results: results.map(result => ({ ...result, terms: [...(result.terms ?? []),
    ...result.projects.filter(Boolean).map(projectName), ...result.fields.map(([, value]) => value)] })) };
}

export const emptySearch = { query: '', project: '', kind: '', researcher: '', period: '', start: '', end: '', status: '', sort: 'relevance' };
export type SearchFilters = typeof emptySearch;

function score(result: Result, keyword: string): number {
  const id = normalize(result.id);
  const name = normalize(result.name);
  if (id === keyword) return 6;
  if (id.includes(keyword)) return 5;
  if (name === keyword) return 4;
  if (name.includes(keyword)) return 3;
  if (normalize(result.researcher ?? '').includes(keyword)) return 2;
  return [result.summary ?? '', ...(result.terms ?? [])].some(value => normalize(value).includes(keyword)) ? 1 : 0;
}

export function searchResults(results: Result[], filters: SearchFilters, now = new Date()) {
  const keywords = normalize(filters.query).split(/\s+/).filter(Boolean);
  const cutoff = new Date(now);
  const days = { week: 6, month: 29 }[filters.period];
  const months = { quarter: 3, half: 6, year: 12 }[filters.period];
  if (days !== undefined) cutoff.setDate(now.getDate() - days);
  if (months !== undefined) {
    cutoff.setDate(1);
    cutoff.setMonth(now.getMonth() - months);
    const lastDay = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
    cutoff.setDate(Math.min(now.getDate(), lastDay));
  }
  const dateKey = (date: Date) => date.toLocaleDateString('sv-SE');
  const start = filters.period === 'custom' ? filters.start : filters.period ? dateKey(cutoff) : '';
  const end = filters.period === 'custom' ? filters.end : filters.period ? dateKey(now) : '';
  return results.flatMap(result => {
    const date = result.date?.slice(0, 10) ?? '';
    if ((filters.project && !result.projects.includes(filters.project)) || (filters.kind && result.kind !== filters.kind)
      || (filters.researcher && result.researcher !== filters.researcher) || (filters.status && result.analysisStatus !== filters.status)
      || ((start || end) && (!date || (start && date < start) || (end && date > end)))) return [];
    const scores = keywords.map(keyword => score(result, keyword));
    if (scores.includes(0)) return [];
    return [{ result, relevance: keywords.length ? score(result, normalize(filters.query)) * 10 + scores.reduce((sum, value) => sum + value, 0) : 0 }];
  }).sort((a, b) => {
    const date = (b.result.date ?? '').localeCompare(a.result.date ?? '');
    const name = a.result.name.localeCompare(b.result.name, 'ko');
    if (filters.sort === 'new') return date || name;
    if (filters.sort === 'old') return (a.result.date && b.result.date ? -date : date) || name;
    if (filters.sort === 'name') return name;
    return b.relevance - a.relevance || date || name;
  }).map(item => item.result);
}
