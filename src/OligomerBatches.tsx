import { availableMaterials, readInventorySafely } from './material-inventory';
import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Upload } from 'lucide-react';
import { makeRow, units, type Material, type Saved, type Unit } from './formulation-model';
import type { ResearchStore } from './calculator-model';
import {
  batchStatuses, batchTypes, blankBatch, readBatches, researchers, saveBatch,
  type Batch, type BatchDraft, type BatchFields, type Ingredient,
} from './oligomer-batches';
import './oligomer-batches.css';

type Project = { id: number; name: string };
const pageSize = 8;
const emptyFilters = { query: '', type: '', date: '', start: '', end: '', researcher: '', status: '' };
const fileLimit = 1024 * 1024;
const extensions = /\.(pdf|csv|xlsx|jpe?g|png)$/i;
const titles: Partial<Record<keyof BatchDraft, string>> = {
  name: '올리고머명', type: '유형', actualDate: '합성일', plannedDate: '예정일',
  researcher: '연구자', composition: '모노머 조성비', basis: '조성 기준',
  catalyst: '촉매', catalystAmount: '촉매 함량', catalystBasis: '촉매 기준',
  temperature: '반응 온도', duration: '반응 시간', solvent: '용매', wash: '세척액',
  mn: 'Mn', pdi: 'PDI', tni: 'Tni', notes: '비고', status: '상태',
  ingredients: '원료 및 Lot', attachments: '첨부 파일', projectIds: '프로젝트',
  formulationRef: '조성 버전', sampleIds: '샘플 ID', analysisRefs: '분석 기록',
};

function localData<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

function fileData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.onabort = reader.onerror;
    reader.readAsDataURL(file);
  });
}

function localDate(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export default function OligomerBatches({ projects }: { projects: Project[] }) {
  const [initial] = useState(() => {
    try { return { records: readBatches(), error: '' }; }
    catch { return { records: [] as Batch[], error: '저장된 배치 기록을 불러오지 못했습니다.' }; }
  });
  const [records, setRecords] = useState(initial.records);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const linkedId = location.hash.startsWith('#oligomer-batches/') ? location.hash.slice('#oligomer-batches/'.length) : '';
  const [draft, setDraft] = useState<BatchDraft | null>(() => initial.records.find(batch => encodeURIComponent(batch.id) === linkedId) ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState('');
  const [picker, setPicker] = useState(false);
  const [materialQuery, setMaterialQuery] = useState('');
  const [materialLots, setMaterialLots] = useState<Record<string, string>>({});
  const editor = useRef<HTMLFormElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const materials = availableMaterials(readInventorySafely());
  const formulations = localData<Saved[]>('isnm-formulations', []);
  const research = localData<ResearchStore | null>('isnm-research-v1', null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guardNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.app > aside nav button, .app > aside .brand')) return;
      if (!window.confirm('저장하지 않은 변경사항이 있습니다. 종료하시겠습니까?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', guardNavigation, true);
    };
  }, [dirty]);
  const types = Array.from(new Set([...batchTypes, ...records.map(batch => batch.type).filter(Boolean)]));
  const people = Array.from(new Set([...researchers, ...records.map(batch => batch.researcher).filter(Boolean)]));
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - ({ week: 6, month: 29, quarter: 89 }[filters.date] ?? 0));
  const start = filters.date === 'custom' ? filters.start : filters.date ? localDate(cutoff) : '';
  const end = filters.date === 'custom' ? filters.end : filters.date ? localDate(today) : '';
  const query = filters.query.trim().toLowerCase();
  const filtered = records.filter(batch => {
    const date = batch.actualDate || batch.plannedDate;
    return [batch.id, batch.name, batch.researcher, batch.notes, batch.composition].some(value => value.toLowerCase().includes(query))
      && (!filters.type || batch.type === filters.type)
      && (!filters.researcher || batch.researcher === filters.researcher)
      && (!filters.status || batch.status === filters.status)
      && (!start || date >= start) && (!end || (date && date <= end));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const allChecked = visible.length > 0 && visible.every(batch => selected.includes(batch.id));
  const activeBatch = records.find(batch => batch.id === draft?.id);
  const relatedSyntheses = activeBatch && research?.syntheses.filter(record =>
    record.input.rows.some(row => row.materialId === 'batch:' + activeBatch.id));
  const relatedSamples = relatedSyntheses?.flatMap(record => record.sampleIds) ?? [];

  function filter(key: keyof typeof filters, value: string) {
    setFilters(previous => ({ ...previous, [key]: value }));
    setPage(1);
  }

  function change(patch: Partial<BatchDraft>) {
    setDraft(previous => previous && ({ ...previous, ...patch }));
    setDirty(true);
  }

  function open(batch: BatchDraft | null, scroll = true) {
    if (operation.current || (dirty && !window.confirm('저장하지 않은 변경사항이 있습니다. 종료하시겠습니까?'))) return;
    setDraft(batch);
    setDirty(false);
    setPicker(false);
    setError('');
    setMessage('');
    if (batch && scroll) requestAnimationFrame(() => editor.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }

  async function persist(temporary: boolean) {
    if (!draft || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await saveBatch(draft, temporary);
      setRecords(result.records);
      setDraft(null);
      setDirty(false);
      setPicker(false);
      setFilters(emptyFilters);
      setPage(Math.floor(result.records.findIndex(batch => batch.id === result.batch.id) / pageSize) + 1);
      setMessage(temporary ? `${result.batch.id} 임시저장 완료` : `${result.batch.id} 합성 기록 저장 완료`);
      document.getElementById('batch-list')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (reason) {
      setError(reason instanceof Error && reason.name !== 'QuotaExceededError'
        ? reason.message : '브라우저 저장 공간이 부족합니다. 첨부를 줄인 뒤 다시 저장해주세요.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function attach(items: FileList | null) {
    if (!draft || !items?.length || operation.current) return;
    const incoming = Array.from(items);
    setError('');
    if (incoming.some(file => !extensions.test(file.name) || file.size > fileLimit)
      || [...incoming, ...draft.attachments].reduce((sum, file) => sum + file.size, 0) > 2 * fileLimit) {
      setError('PDF, CSV, XLSX, JPG, PNG 파일을 개별 1 MB, 배치당 총 2 MB까지 첨부할 수 있습니다.');
      return;
    }
    operation.current = true;
    setBusy(true);
    try {
      const added = await Promise.all(incoming.map(async file => ({
        id: crypto.randomUUID(), name: file.name, type: file.type || file.name.split('.').pop() || '',
        size: file.size, data: await fileData(file), uploadedAt: new Date().toISOString(), uploadedBy: draft.researcher,
      })));
      change({ attachments: [...draft.attachments, ...added] });
    } catch {
      setError('첨부 파일을 읽지 못했습니다. 다시 선택해주세요.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  function ingredient(id: string, patch: Partial<Ingredient>) {
    if (draft) change({ ingredients: draft.ingredients.map(row => row.id === id ? { ...row, ...patch } : row) });
  }

  function addMaterial(material: Material, lotId: string) {
    if (!draft) return;
    const lot = material.lots.find(entry => entry.id === lotId);
    if (!lot) return;
    const purity = (lot as typeof lot & { purity?: number | null }).purity
      ?? (material as Material & { purity?: number | null }).purity ?? null;
    change({ ingredients: [...draft.ingredients, { ...makeRow(material, lot.id, ''), purity }] });
    setPicker(false);
  }

  function field(key: keyof BatchFields, options: { unit?: string; chips?: string[]; hint?: string; type?: string } = {}) {
    if (!draft) return null;
    return <div className="ob-field">
      <label htmlFor={'ob-' + key}>{titles[key]}{['name', 'type'].includes(key) && <em> *</em>}</label>
      <div className="ob-input">
        <input id={'ob-' + key} value={draft[key]} type={options.type === 'number' ? 'text' : options.type ?? 'text'}
          inputMode={options.type === 'number' ? 'decimal' : undefined} placeholder={options.hint}
          list={key === 'type' ? 'ob-types' : undefined} onChange={event => change({ [key]: event.target.value })}/>
        {options.unit && <span>{options.unit}</span>}
      </div>
      {options.chips && <div className="ob-chips"><small>자주 사용</small>{options.chips.map(value =>
        <button type="button" key={value} onClick={() => change({ [key]: value })}>{value}{options.unit && ' ' + options.unit}</button>)}</div>}
    </div>;
  }

  function researcher(value: string) {
    return <select aria-label="연구자" value={value} onChange={event => change({ researcher: event.target.value })}>
      {people.map(person => <option key={person}>{person}</option>)}
    </select>;
  }

  return <section className="ob-page">
    <div className="ob-heading"><div><h1>올리고머 배치 관리</h1><p>합성 이력부터 분석 결과까지, 배치 단위로 관리하세요.</p></div>
      <button className="ob-primary" onClick={() => open(blankBatch(), false)} disabled={busy}><Plus size={17}/> 새 올리고머 합성</button></div>
    <datalist id="ob-types">{types.map(type => <option key={type} value={type}/>)}</datalist>
    <div className="ob-filters">
      <label className="ob-search"><Search size={16}/><input aria-label="배치 검색" value={filters.query}
        placeholder="Batch ID, 올리고머명, 연구자 검색…" onChange={event => filter('query', event.target.value)}/></label>
      <label>올리고머 유형<select value={filters.type} onChange={event => filter('type', event.target.value)}>
        <option value="">전체</option>{types.map(type => <option key={type}>{type}</option>)}</select></label>
      <label>합성일<select value={filters.date} onChange={event => filter('date', event.target.value)}>
        <option value="">전체 기간</option><option value="week">최근 7일</option><option value="month">최근 30일</option>
        <option value="quarter">최근 3개월</option><option value="custom">사용자 지정</option></select></label>
      <label>연구자<select value={filters.researcher} onChange={event => filter('researcher', event.target.value)}>
        <option value="">전체</option>{people.map(person => <option key={person}>{person}</option>)}</select></label>
      <label>상태<select value={filters.status} onChange={event => filter('status', event.target.value)}>
        <option value="">전체</option>{batchStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
      <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }}>초기화</button>
      {filters.date === 'custom' && <div className="ob-range">
        <label>시작일<input type="date" value={filters.start} max={filters.end || undefined} onChange={event => filter('start', event.target.value)}/></label>
        <label>종료일<input type="date" value={filters.end} min={filters.start || undefined} onChange={event => filter('end', event.target.value)}/></label>
      </div>}
    </div>
    <section className="ob-list" id="batch-list" aria-labelledby="ob-list-title">
      <div className="ob-list-title"><h2 id="ob-list-title">배치 목록</h2><span>총 {filtered.length}건</span>
        {draft && !draft.id && <span className="ob-badge">새 배치 작성 중</span>}
        {selected.length > 0 && <span>{selected.length}건 선택</span>}</div>
      {records.some(batch => batch.example) && <p className="ob-muted">예시 배치에는 ‘예시’가 표시됩니다.</p>}
      <div className="ob-scroll"><table>
        <thead><tr><th><input type="checkbox" checked={allChecked} disabled={!visible.length} aria-label="현재 페이지 배치 전체 선택"
          onChange={() => setSelected(previous => allChecked ? previous.filter(id => !visible.some(batch => batch.id === id))
            : Array.from(new Set([...previous, ...visible.map(batch => batch.id)])))}/></th>
          {['Batch ID', '올리고머명', '유형', '합성일', '연구자', '모노머 조성비', 'Mn (g/mol)', 'PDI', '상태', '비고'].map(name => <th key={name}>{name}</th>)}</tr></thead>
        <tbody>{visible.map(batch => <tr key={batch.id} className={draft?.id === batch.id ? 'ob-active' : ''}>
          <td><input type="checkbox" aria-label={batch.id + ' 선택'} checked={selected.includes(batch.id)}
            onChange={() => setSelected(previous => previous.includes(batch.id) ? previous.filter(id => id !== batch.id) : [...previous, batch.id])}/></td>
          <td><button className="ob-link" onClick={() => open(batch)}>{batch.id}</button></td><td>{batch.name || '—'} {batch.example && <small>예시</small>}</td>
          <td>{batch.type || '—'}</td><td>{batch.actualDate || (batch.plannedDate && batch.plannedDate + ' 예정') || '—'}</td>
          <td>{batch.researcher || '—'}</td><td>{batch.composition || '—'}</td>
          <td className="ob-num">{batch.mn ? Number(batch.mn).toLocaleString('ko-KR') : '—'}</td><td className="ob-num">{batch.pdi || '—'}</td>
          <td><span className="ob-badge" data-status={batch.status}>{batch.status}</span></td><td className="ob-ellipsis" title={batch.notes}>{batch.notes || '—'}</td>
        </tr>)}
        {draft && !draft.id && <tr className="ob-active"><td/><td>저장 시 자동 생성</td>
          <td><input aria-label="새 행 올리고머명" placeholder="이름 입력" value={draft.name} onChange={event => change({ name: event.target.value })}/></td>
          <td><input aria-label="새 행 유형" list="ob-types" placeholder="유형" value={draft.type} onChange={event => change({ type: event.target.value })}/></td>
          <td><input aria-label="새 행 합성일" type="date" value={draft.actualDate} onChange={event => change({ actualDate: event.target.value })}/></td>
          <td>{researcher(draft.researcher)}</td><td>{draft.composition || '—'}</td><td>{draft.mn || '—'}</td>
          <td>{draft.pdi || '—'}</td><td><span className="ob-badge">작성 중</span></td><td>—</td></tr>}
        {!visible.length && !draft && <tr><td colSpan={11} className="ob-empty">{records.length ? '검색 조건에 맞는 배치가 없습니다.' : '등록된 올리고머 배치가 없습니다.'}
          {!records.length && <button onClick={() => open(blankBatch(), false)}>새 올리고머 합성</button>}</td></tr>}
        </tbody></table></div>
      <div className="ob-list-footer"><span>{draft && !draft.id ? '아래에서 합성 정보를 입력하세요.' : message}</span>
        {pageCount > 1 && <div className="ob-pagination">
          <button disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="이전 페이지">‹</button>
          <span>{current} / {pageCount}</span>
          <button disabled={current === pageCount} onClick={() => setPage(current + 1)} aria-label="다음 페이지">›</button>
        </div>}</div>
    </section>
    {draft && <form className="ob-editor" ref={editor} noValidate onSubmit={event => { event.preventDefault(); void persist(false); }}>
      <fieldset disabled={busy}>
        <div className="ob-editor-head"><div><h2>{draft.id ? '배치 기록 수정' : '새 올리고머 합성'}</h2>
          {draft.id && <span className="ob-muted">{draft.id}</span>}</div>
          {field('name', { hint: '올리고머 이름 입력' })}
          <div className="ob-field"><label htmlFor="ob-actualDate">합성일 <em>*</em></label>
            <input id="ob-actualDate" type="date" value={draft.actualDate} onChange={event => change({ actualDate: event.target.value })}/></div>
          <div className="ob-field"><span>연구자 <em>*</em></span>{researcher(draft.researcher)}</div>
        </div>
        <div className="ob-editor-grid">
          <section className="ob-recipe"><h3>합성 레시피 요약</h3><div className="ob-fields">
            {field('type', { hint: '검색 또는 직접 입력', chips: ['CLCE', 'SMP', 'Epoxy'] })}
            {field('composition', { hint: '예: RM82 / CM18', chips: ['RM82 / CM18', 'RM70 / CM30'] })}
            {field('catalyst', { chips: ['DBU', 'TBD', 'Sn(Oct)₂'] })}
            {field('catalystAmount', { unit: 'wt%', type: 'number', chips: ['0.1', '0.5', '1.0'] })}
            {field('temperature', { unit: '°C', type: 'number', chips: ['60', '80', '100'] })}
            {field('duration', { unit: 'h', type: 'number', chips: ['4', '6', '12'] })}
            {field('solvent', { chips: ['THF', '에탄올'] })}{field('wash', { hint: '예: 에탄올 95%' })}
            {field('plannedDate', { type: 'date' })}
            <label className="ob-field">조성 기준<select value={draft.basis} onChange={event => change({ basis: event.target.value })}>
              {['wt%', 'mol%', '작용기 당량', '미지정'].map(basis => <option key={basis}>{basis}</option>)}</select></label>
            <label className="ob-field">촉매 함량 기준<select value={draft.catalystBasis} onChange={event => change({ catalystBasis: event.target.value })}>
              {['전체 조성', '모노머', '수지'].map(basis => <option key={basis}>{basis}</option>)}</select></label>
          </div></section>
          <section className="ob-materials"><h3>원료 물질 (Lot)</h3><p className="ob-muted">원료 라이브러리에서 사용한 Lot를 선택하세요.</p>
            {!draft.ingredients.length && <p className="ob-muted">추가된 원료가 없습니다.</p>}
            <div className="ob-ingredients">{draft.ingredients.map(row => <div className="ob-ingredient" key={row.id}>
              <div><strong>{row.name}</strong><small>{row.lot}</small></div>
              <label>계획량<input inputMode="decimal" value={row.plannedAmount ?? ''} onChange={event => ingredient(row.id, { plannedAmount: event.target.value })}/></label>
              <label>실제량<input inputMode="decimal" value={row.amount} onChange={event => ingredient(row.id, { amount: event.target.value })}/></label>
              <label>단위<select value={row.unit} onChange={event => ingredient(row.id, { unit: event.target.value as Unit })}>
                {units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
              <button type="button" aria-label={row.name + ' 삭제'} onClick={() => change({ ingredients: draft.ingredients.filter(item => item.id !== row.id) })}>×</button>
            </div>)}</div>
            <button type="button" onClick={() => { setPicker(!picker); setMaterialQuery(''); }}><Plus size={15}/> 원료 추가</button>
            {picker && <div className="ob-picker">
              <input aria-label="원료 검색" placeholder="원료명, ID, Lot, 제조사 검색" value={materialQuery} onChange={event => setMaterialQuery(event.target.value)}/>
              {materials.filter(material => [material.name, material.id, (material as Material & { manufacturer?: string }).manufacturer,
                ...material.lots.flatMap(lot => [lot.id, lot.name, lot.inventory?.manufacturer])].some(value => value?.toLowerCase().includes(materialQuery.trim().toLowerCase())))
                .map(material => <div className="ob-picker-row" key={material.id}>
                  <span>{material.name}</span><select aria-label={material.name + ' Lot'} value={materialLots[material.id] ?? material.lots[0]?.id ?? ''}
                    onChange={event => setMaterialLots(previous => ({ ...previous, [material.id]: event.target.value }))}>
                    {material.lots.map(lot => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select>
                  <button type="button" disabled={!material.lots.length}
                    onClick={() => addMaterial(material, materialLots[material.id] ?? material.lots[0]?.id ?? '')}>선택</button>
                </div>)}
            </div>}
            <h3 className="ob-attachment-title">첨부 파일</h3>
            <input hidden ref={files} type="file" multiple accept=".pdf,.csv,.xlsx,.jpg,.jpeg,.png"
              onChange={event => { void attach(event.currentTarget.files); event.currentTarget.value = ''; }}/>
            <button className="ob-drop" type="button" onClick={() => files.current?.click()}
              onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void attach(event.dataTransfer.files); }}>
              <Upload size={23}/><span>파일을 끌어 놓거나 선택하세요.</span><small>PDF, CSV, XLSX, JPG, PNG · 파일당 1 MB, 총 2 MB</small>
            </button>
            {draft.attachments.map(file => <div className="ob-file" key={file.id}>
              <a href={file.data} download={file.name}>{file.name}</a>
              <button type="button" aria-label={file.name + ' 제거'} onClick={() => change({ attachments: draft.attachments.filter(item => item.id !== file.id) })}>×</button>
            </div>)}
          </section>
          <section className="ob-analysis"><h3>분석값 <small>· 나중에 입력 가능</small></h3><div className="ob-fields">
            {field('mn', { unit: 'g/mol', type: 'number' })}{field('pdi', { type: 'number' })}{field('tni', { unit: '°C', type: 'number' })}
            <label className="ob-field">상태<select value={draft.status} onChange={event => change({ status: event.target.value as BatchDraft['status'] })}>
              {batchStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
          </div></section>
          <label className="ob-notes"><span>비고</span><textarea value={draft.notes} placeholder="합성 과정의 관찰 사항이나 특이사항을 기록하세요."
            onChange={event => change({ notes: event.target.value })}/></label>
        </div>
        <details className="ob-links"><summary>연결된 연구 기록</summary><div className="ob-fields">
          <label className="ob-field">프로젝트<select multiple size={Math.min(4, Math.max(2, projects.length))} value={draft.projectIds}
            onChange={event => change({ projectIds: Array.from(event.target.selectedOptions, option => option.value) })}>
            {projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></label>
          <label className="ob-field">조성 버전<select value={draft.formulationRef}
            onChange={event => change({ formulationRef: event.target.value })}>
            <option value="">선택 안 함</option>
            {draft.formulationRef && !formulations.some(formulation => `${formulation.id}:${formulation.version}` === draft.formulationRef)
              && <option value={draft.formulationRef}>{draft.formulationRef}</option>}
            {formulations.map(formulation => <option key={`${formulation.id}:${formulation.version}`} value={`${formulation.id}:${formulation.version}`}>
              {formulation.name} v{formulation.version}</option>)}</select></label>
          <label className="ob-field">샘플 ID<input value={draft.sampleIds} onChange={event => change({ sampleIds: event.target.value })}/></label>
          <label className="ob-field">분석 기록 ID<input value={draft.analysisRefs} onChange={event => change({ analysisRefs: event.target.value })}/></label>
          {!!research?.samples.length && <label className="ob-field">기존 샘플 추가<select value="" onChange={event => {
            const id = event.target.value;
            if (id) change({ sampleIds: Array.from(new Set([...draft.sampleIds.split(',').map(value => value.trim()).filter(Boolean), id])).join(', ') });
          }}><option value="">샘플 선택</option>
            {research.samples.map(sample => <option key={sample.id} value={sample.id}>{sample.name || sample.id}</option>)}
          </select></label>}
        </div>
        {!!relatedSyntheses?.length && <div className="ob-history">
          <strong>이 배치를 사용한 합성 기록</strong>
          {relatedSyntheses.map(record => <p key={record.id}><a href={'#project/' + encodeURIComponent(record.projectId)}>{record.id}</a></p>)}
          {!!relatedSamples.length && <p>연결된 샘플 {Array.from(new Set(relatedSamples)).join(', ')}</p>}
        </div>}</details>
        {!!activeBatch?.history.length && <details className="ob-links"><summary>변경 이력 ({activeBatch.history.length}건)</summary>
          {[...activeBatch.history].reverse().map((entry, index) => <div className="ob-history" key={entry.at + index}>
            <strong>{new Date(entry.at).toLocaleString('ko-KR')} · {entry.by}</strong>
            {entry.fields.map(item => <p key={item.key}><b>{titles[item.key as keyof BatchDraft] ?? item.key}</b>
              {' · '}{JSON.stringify(item.before)} → {JSON.stringify(item.after)}</p>)}
          </div>)}</details>}
        {error && <p className="ob-error" role="alert">{error}</p>}
        <div className="ob-actions"><span className="ob-muted">저장한 기록은 이 브라우저에 보관됩니다.</span>
          <button type="button" onClick={() => open(null)}>취소</button>
          <button type="button" onClick={() => void persist(true)}>임시저장</button>
          <button type="submit" className="ob-primary">{busy ? '처리 중…' : '합성 기록 저장'}</button>
        </div>
      </fieldset>
    </form>}
    {!draft && error && <p className="ob-error" role="alert">{error}</p>}
    <span className="ob-sr" role="status">{message}</span>
  </section>;
}
