import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Pencil, Plus, Search, Upload } from 'lucide-react';
import { components, type Saved, type Unit } from './formulation-model';
import type { ResearchStore } from './calculator-model';
import { readBatches } from './oligomer-batches';
import {
  companies, lifecycle, locations, makeMaterialDraft, materialDraftKey, phases, readInventory,
  saveMaterial, states, validateMaterial, type MaterialDraft, type InventoryMaterial, type InventoryLot,
} from './material-inventory';
import './material-inventory.css';

const filtersInitial = { query: '', location: '', state: '', manufacturer: '' };
const titles = {
  name: '물질명', lot: 'Lot 번호', cas: 'CAS 번호', manufacturer: '회사명', location: '보관 위치',
  state: '상태', capacity: '용량', remaining: '잔량', purchased: '구매일', opened: '개봉일',
  mw: '분자량', density: '밀도', viscosity: '점도', measurementTemperature: '측정 온도',
  measurementConditions: '측정 조건', phaseValue: '상변화점', purity: '순도', functionality: '작용기 수',
} as const;
const required = ['name', 'location', 'state', 'capacity'];
const amountUnits = ['mg', 'g', 'kg', 'µL', 'mL', 'L', 'mmol', 'mol'];
const pageSize = 8;
const columns = ['이름', '위치', 'CAS', '용량', '분자량|g/mol', '상변화점|°C', '회사명', '점도|mPa·s', '밀도|g/cm³', '상태', '구매일', '개봉일', 'MSDS'];

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

function usage(materialId: string, lotId: string) {
  const matches = (row: { materialId: string; lotId: string }) => row.materialId === materialId && row.lotId === lotId;
  let batches: ReturnType<typeof readBatches> = [];
  try { batches = readBatches(); } catch { /* Leave other trace records available. */ }
  const formulations = read<Saved[]>('isnm-formulations', []).filter(record => record.rows.some(matches));
  const research = read<ResearchStore | null>('isnm-research-v1', null);
  const usedBatches = batches.filter(batch => batch.ingredients.some(matches));
  const batchIds = new Set(usedBatches.map(batch => 'batch:' + batch.id));
  const syntheses = research?.syntheses.filter(record => record.input.rows.some(row => matches(row) || batchIds.has(row.materialId))) ?? [];
  const sampleIds = new Set([...syntheses.flatMap(record => record.sampleIds),
    ...usedBatches.flatMap(batch => batch.sampleIds.split(',').map(value => value.trim()).filter(Boolean))]);
  return { batches: usedBatches, formulations, syntheses, samples: Array.from(sampleIds).map(id => {
    const sample = research?.samples.find(item => item.id === id);
    return { id, name: sample?.name ?? id, analysis: sample?.analysis };
  }) };
}

export default function MaterialInventory() {
  const [initial] = useState(() => {
    try { return { records: readInventory(), error: '' }; }
    catch { return { records: [] as InventoryMaterial[], error: '원료물질 데이터를 불러오지 못했습니다.' }; }
  });
  const [records, setRecords] = useState(initial.records);
  const [savedDraft, setSavedDraft] = useState(() => read<MaterialDraft | null>(materialDraftKey, null));
  const [draft, setDraft] = useState<MaterialDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(() => initial.records.flatMap(material => material.lots).find(lot => '#materials/' + encodeURIComponent(lot.id) === location.hash)?.id ?? initial.records.find(material => material.id === 'rm82')?.lots[0]?.id ?? initial.records[0]?.lots[0]?.id ?? '');
  const [checked, setChecked] = useState<string[]>([]);
  const [filters, setFilters] = useState(filtersInitial);
  const [page, setPage] = useState(1);
  const [errors, setErrors] = useState<ReturnType<typeof validateMaterial>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLFormElement>(null);
  const historyPanel = useRef<HTMLDetailsElement>(null);
  const usagePanel = useRef<HTMLDetailsElement>(null);
  const rows = records.flatMap(material => material.lots.map(lot => ({ material, lot, values: makeMaterialDraft(material, lot) })));
  const selectedRow = rows.find(row => row.lot.id === selected);
  const query = filters.query.trim().toLowerCase();
  const filtered = rows.filter(({ material, lot, values }) => [material.name, material.id, lot.name, values.cas, values.manufacturer, values.location]
    .some(value => value.toLowerCase().includes(query))
    && (!filters.location || values.location === filters.location)
    && (!filters.state || values.state === filters.state || values.lifecycle === filters.state)
    && (!filters.manufacturer || values.manufacturer === filters.manufacturer));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const allChecked = visible.length > 0 && visible.every(row => checked.includes(row.lot.id));
  const linked = selectedRow && usage(selectedRow.material.id, selectedRow.lot.id);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guard = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.app > aside nav button, .app > aside .brand')
        && !window.confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guard, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guard, true); };
  }, [dirty]);

  function edit(next: MaterialDraft | null) {
    if (locked.current || (dirty && !window.confirm('저장하지 않은 변경사항을 취소하시겠습니까?'))) return;
    setDraft(next); setDirty(false); setErrors({}); setError(''); setMessage('');
    if (next) requestAnimationFrame(() => editor.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function patch(values: Partial<MaterialDraft>) {
    setDraft(previous => previous && { ...previous, ...values });
    setDirty(true);
    setErrors(previous => ({ ...previous, ...Object.fromEntries(Object.keys(values).map(key => [key, undefined])) }));
  }

  async function persist(temporary: boolean) {
    if (!draft || locked.current) return;
    const problems = validateMaterial(draft, temporary);
    setErrors(problems);
    if (Object.keys(problems).length) { setError('표시된 입력 항목을 확인해주세요.'); return; }
    locked.current = true; setBusy(true); setError('');
    try {
      if (temporary) {
        localStorage.setItem(materialDraftKey, JSON.stringify(draft));
        setSavedDraft(draft);
      } else {
        const result = navigator.locks ? await navigator.locks.request('isnm-material-inventory', () => saveMaterial(draft)) : saveMaterial(draft);
        setRecords(result.records); setSelected(result.lotId); setFilters(filtersInitial);
        const index = result.records.flatMap(material => material.lots).findIndex(lot => lot.id === result.lotId);
        setPage(Math.floor(index / pageSize) + 1);
        if (savedDraft && savedDraft.lotId === draft.lotId && savedDraft.materialId === draft.materialId) {
          localStorage.removeItem(materialDraftKey); setSavedDraft(null);
        }
      }
      setDraft(null); setDirty(false); setMessage(temporary ? '작성 내용을 임시저장했습니다.' : '원료물질을 저장했습니다.');
    } catch (reason) {
      setError(reason instanceof Error && reason.name !== 'QuotaExceededError'
        ? reason.message : '브라우저 저장 공간이 부족합니다. 입력 내용은 유지됩니다.');
    } finally { locked.current = false; setBusy(false); }
  }

  async function attach(file?: File) {
    if (!file || locked.current) return;
    setError('');
    if (!/\.pdf$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
      setError('2 MB 이하의 PDF 파일을 선택해주세요.'); return;
    }
    locked.current = true; setBusy(true);
    try {
      const header = await file.slice(0, 5).text();
      if (header !== '%PDF-') throw new Error('PDF 문서 형식을 확인해주세요.');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, 'data:application/pdf;base64,'));
        reader.onerror = () => reject(new Error('문서를 읽지 못했습니다.'));
        reader.onabort = reader.onerror;
        reader.readAsDataURL(file);
      });
      patch({ msds: { id: crypto.randomUUID(), name: file.name, size: file.size, data, uploadedAt: new Date().toISOString(), uploadedBy: '김지원' } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '문서를 읽지 못했습니다.');
    } finally { locked.current = false; setBusy(false); }
  }

  function viewPdf(document: NonNullable<MaterialDraft['msds']>) {
    const bytes = Uint8Array.from(atob(document.data.split(',')[1]), character => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function field(key: keyof typeof titles, options: { unit?: string; type?: string; chips?: string[]; hint?: string } = {}) {
    if (!draft) return null;
    const disabled = (key === 'opened' && draft.unopened) || ((key === 'name' || key === 'cas') && !!draft.materialId && !draft.lotId);
    return <div className="ob-field mi-field">
      <label htmlFor={'mi-' + key}>{titles[key]}{required.includes(key) && <em> *</em>}</label>
      <div className="ob-input"><input id={'mi-' + key} type={options.type === 'date' ? 'date' : 'text'}
        inputMode={options.type === 'number' ? 'decimal' : undefined} value={draft[key]} disabled={disabled}
        aria-invalid={!!errors[key]} aria-describedby={errors[key] ? 'mi-error-' + key : undefined}
        placeholder={options.hint} list={options.chips ? 'mi-list-' + key : undefined}
        onChange={event => patch({ [key]: event.target.value })}/>{options.unit && <span>{options.unit}</span>}</div>
      {!!options.chips?.length && <><datalist id={'mi-list-' + key}>{Array.from(new Set([...options.chips, ...rows.map(row => row.values[key]).filter(Boolean)])).map(value => <option key={value} value={value}/>)}</datalist>
        <div className="ob-chips">{options.chips.map(value => <button key={value} type="button" onClick={() => patch({ [key]: value })}>{value}</button>)}</div></>}
      {errors[key] && <small className="ob-error" id={'mi-error-' + key}>{errors[key]}</small>}
    </div>;
  }

  function cellValues(values: MaterialDraft) {
    return [
      values.location, values.cas, values.capacity && values.capacity + ' ' + values.unit, values.mw,
      values.phaseValue && values.phase + ' ' + values.phaseValue, values.manufacturer, values.viscosity, values.density,
    ];
  }

  function openRow(material: InventoryMaterial, lot: InventoryLot) {
    if (locked.current || (dirty && !window.confirm('저장하지 않은 변경사항을 취소하시겠습니까?'))) return;
    setDraft(null); setDirty(false); setErrors({}); setError(''); setSelected(lot.id);
    setChecked(previous => previous.includes(lot.id) ? previous : [...previous, lot.id]);
  }

  function detail(title: string, items: [string, string][]) {
    return <section className="mi-card"><h3>{title}</h3><dl>
      {items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
    </dl></section>;
  }

  return <section className="ob-page mi-page">
    <div className="ob-heading"><div><h1>원료물질 DB</h1><p>연구실의 원료와 시약을 한곳에서 검색하고 관리하세요.</p></div>
      <button className="ob-primary" onClick={() => edit(makeMaterialDraft())} disabled={busy}><Plus size={17}/> 새 물질 추가</button></div>
    <div className="ob-filters">
      <label className="ob-search"><Search size={16}/><input aria-label="원료물질 검색" placeholder="물질명, CAS 번호, 회사명 검색…"
        value={filters.query} onChange={event => { setFilters({ ...filters, query: event.target.value }); setPage(1); }}/></label>
      {(['location', 'state', 'manufacturer'] as const).map(key => <label key={key}>{titles[key]}
        <select value={filters[key]} onChange={event => { setFilters({ ...filters, [key]: event.target.value }); setPage(1); }}>
          <option value="">전체</option>
          {Array.from(new Set([...rows.map(row => row.values[key]), ...(key === 'state' ? lifecycle : [])].filter(Boolean))).map(value => <option key={value}>{value}</option>)}
        </select></label>)}
      <button onClick={() => { setFilters(filtersInitial); setPage(1); }}>초기화</button>
    </div>
    <section className="ob-list" aria-labelledby="mi-list-title">
      <div className="ob-list-title"><h2 id="mi-list-title">보유 물질</h2><span>총 {filtered.length}건</span>
        {draft && !draft.lotId && <span className="ob-badge">작성 중</span>}
        {checked.length > 0 && <span>{checked.length}건 선택</span>}</div>
      <div className="ob-scroll"><table>
        <thead><tr><th><input type="checkbox" aria-label="현재 페이지 전체 선택" checked={allChecked} disabled={!visible.length}
          onChange={() => setChecked(previous => allChecked ? previous.filter(id => !visible.some(row => row.lot.id === id))
            : [...new Set([...previous, ...visible.map(row => row.lot.id)])])}/></th>
          {columns.map(column => { const [label, unit] = column.split('|'); return <th key={column}>{label}{unit && <small>{unit}</small>}</th>; })}
        </tr></thead>
        <tbody>{visible.map(({ material, lot, values }) => <tr key={lot.id} className={selected === lot.id || checked.includes(lot.id) ? 'ob-active' : ''}>
          <td><input type="checkbox" checked={checked.includes(lot.id)} aria-label={material.name + ' ' + lot.name + ' 선택'}
            onChange={() => { if (checked.includes(lot.id)) setChecked(previous => previous.filter(id => id !== lot.id)); else openRow(material, lot); }}/></td>
          <td><button className="ob-link mi-name" onClick={() => openRow(material, lot)}><strong>{material.name}</strong><small>{lot.name}{(lot.example ?? material.example) && ' · 예시'}</small></button></td>
          {cellValues(values).map((value, index) => <td key={index}>{value || '—'}</td>)}
          <td><span className="ob-badge">{values.state || values.lifecycle}</span>{values.state && values.lifecycle !== 'Active' && <small>{values.lifecycle}</small>}</td>
          <td>{values.purchased || '—'}</td><td>{values.opened || (lot.inventory && values.unopened ? '미개봉' : '—')}</td>
          <td>{values.msds ? <button className="ob-link mi-pdf" aria-label={material.name + ' MSDS 보기'} onClick={() => viewPdf(values.msds!)}><FileText size={19}/></button> : '—'}</td>
        </tr>)}
        {draft && !draft.lotId && <tr className="ob-active"><td/><td><strong>{draft.name || '새 물질 작성 중'}</strong><small>{draft.lot}</small></td>
          {cellValues(draft).map((value, index) => <td key={index}>{value || '—'}</td>)}
          <td><span className="ob-badge">작성 중</span></td><td>{draft.purchased || '—'}</td><td>{draft.opened || '—'}</td><td>{draft.msds ? 'PDF' : '—'}</td></tr>}
        {savedDraft && !draft && <tr className="mi-draft-row"><td/><td colSpan={13}><button className="ob-link" onClick={() => edit(savedDraft)}>
          {savedDraft.name || '새 물질'} · 임시저장 이어서 작성</button></td></tr>}
        {!visible.length && !draft && !savedDraft && <tr><td colSpan={14} className="ob-empty">{rows.length ? '검색 조건에 맞는 물질이 없습니다.' : '등록된 원료물질이 없습니다.'}</td></tr>}
        </tbody>
      </table></div>
      <div className="ob-list-footer"><span>{draft && !draft.lotId ? '아래 입력한 정보가 새 행에 반영됩니다.' : '— 미등록 정보'}</span>
        {pages > 1 && <div className="ob-pagination"><button disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="이전 페이지">‹</button>
          <span>{current} / {pages}</span><button disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="다음 페이지">›</button></div>}
      </div>
    </section>
    {draft ? <form className="ob-editor mi-editor" ref={editor} noValidate onSubmit={event => { event.preventDefault(); void persist(false); }}>
      <fieldset disabled={busy}>
        <div className="mi-detail-heading"><div><h2>{draft.lotId ? '물질 수정' : '새 물질 추가'}</h2><p>기본 정보와 보관 위치를 입력하고 MSDS를 첨부하세요.</p></div><span><em>*</em> 필수 항목</span></div>
        <div className="mi-grid">
          <section className="mi-card"><h3>기본 정보</h3>
            {!draft.lotId && <label className="ob-field">기존 물질의 새 Lot<select value={draft.materialId} onChange={event => {
              const material = records.find(item => item.id === event.target.value);
              const base = makeMaterialDraft(material);
              patch({ materialId: base.materialId, name: base.name, cas: base.cas, component: base.component, mw: base.mw, density: base.density, functionality: base.functionality });
            }}><option value="">새 물질 등록</option>{records.map(material => <option value={material.id} key={material.id}>{material.name}{material.cas ? ' · ' + material.cas : ''}</option>)}</select></label>}
            {field('name', { hint: '물질명 또는 제품명 입력' })}
            <div className="mi-pair">{field('cas', { hint: '예: 000-00-0' })}{field('lot')}</div>
            {draft.cas.trim() && records.some(material => material.id !== draft.materialId && material.cas === draft.cas.trim())
              && <p className="ob-muted">동일 CAS가 등록되어 있습니다. 기존 물질을 선택하거나 별도 제품으로 등록할 수 있습니다.</p>}
            {field('manufacturer', { chips: companies, hint: '검색 또는 직접 입력' })}
            <div className="mi-pair">{field('capacity', { type: 'number' })}
              <label className="ob-field">단위<select value={draft.unit} onChange={event => patch({ unit: event.target.value as Unit })}>
                {amountUnits.map(unit => <option key={unit}>{unit}</option>)}</select></label></div>
            {field('remaining', { type: 'number', unit: draft.unit })}
            {field('state', { chips: states, hint: '검색 또는 직접 입력' })}
            <label className="ob-field">원료 분류<select value={draft.component} onChange={event => patch({ component: event.target.value })}>
              {components.map(component => <option key={component}>{component}</option>)}</select></label>
          </section>
          <section className="mi-card"><h3>보관 및 구매 정보</h3>
            {field('location', { chips: locations, hint: '보관 위치 선택 또는 입력' })}
            {field('purchased', { type: 'date' })}{field('opened', { type: 'date' })}
            <label className="mi-check"><input type="checkbox" checked={draft.unopened} onChange={event => patch({ unopened: event.target.checked })}/> 미개봉</label>
            <label className="ob-field">재고 상태<select value={draft.lifecycle} onChange={event => patch({ lifecycle: event.target.value as MaterialDraft['lifecycle'] })}>
              {lifecycle.map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="ob-field">비고<textarea rows={5} placeholder="제품 특이사항이나 관리 메모를 입력하세요."
              value={draft.notes} onChange={event => patch({ notes: event.target.value })}/></label>
          </section>
          <section className="mi-card"><h3>물성 및 문서</h3>
            <div className="mi-pair">{field('mw', { type: 'number', unit: 'g/mol' })}{field('density', { type: 'number', unit: 'g/cm³' })}</div>
            <div className="mi-pair">{field('viscosity', { type: 'number', unit: 'mPa·s' })}{field('measurementTemperature', { type: 'number', unit: '°C' })}</div>
            {field('measurementConditions')}
            <div className="mi-pair"><label className="ob-field">상변화 유형<select value={draft.phase} aria-invalid={!!errors.phase} onChange={event => patch({ phase: event.target.value })}>
              <option value="">종류 선택</option>{phases.map(phase => <option key={phase}>{phase}</option>)}</select>
              {errors.phase && <small className="ob-error">{errors.phase}</small>}</label>{field('phaseValue', { type: 'number', unit: '°C' })}</div>
            <div className="mi-pair">{field('purity', { type: 'number', unit: '%' })}{field('functionality', { type: 'number' })}</div>
            <input hidden type="file" accept="application/pdf,.pdf" ref={input}
              onChange={event => { void attach(event.target.files?.[0]); event.target.value = ''; }}/>
            <button className="ob-drop" type="button" onClick={() => input.current?.click()}
              onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void attach(event.dataTransfer.files[0]); }}>
              <Upload size={20}/> MSDS PDF를 끌어 놓거나 선택하세요.<small>파일당 최대 2 MB</small></button>
            {draft.msds && <div className="mi-document"><span>{draft.msds.name}</span><button type="button" onClick={() => patch({ msds: undefined })}>제거</button></div>}
          </section>
        </div>
        {error && <p className="ob-error" role="alert">{error}</p>}
        <div className="ob-actions"><button type="button" onClick={() => edit(null)}>취소</button>
          <button type="button" onClick={() => void persist(true)}>임시저장</button>
          <button type="submit" className="ob-primary">{busy ? '처리 중…' : '물질 저장'}</button></div>
      </fieldset>
    </form> : selectedRow && (() => {
      const { material, lot, values } = selectedRow;
      const hasUsage = linked && (linked.batches.length || linked.formulations.length || linked.syntheses.length || linked.samples.length);
      return <section className="ob-editor mi-detail" key={lot.id}>
        <div className="mi-detail-heading"><div className="mi-detail-name"><h2>{material.name}</h2><span>{lot.name}</span>
          <span className="ob-badge">{values.state || values.lifecycle}</span>{(lot.example ?? material.example) && <small>예시 물질</small>}</div>
          <div className="mi-tools"><button className="ob-primary" onClick={() => edit(values)}><Pencil size={14}/> 수정</button>
            <details className="mi-menu"><summary aria-label="추가 작업">⋯</summary><div>
              <button onClick={() => edit({ ...values, lotId: '', lot: '', revision: 0, purchased: '', opened: '', unopened: true, remaining: '', lifecycle: 'Active', msds: undefined })}>복제하여 새 Lot 등록</button>
              <button onClick={() => edit({ ...values, lifecycle: values.lifecycle === 'Archived' ? 'Active' : 'Archived' })}>{values.lifecycle === 'Archived' ? '보관 해제' : '보관 처리'}</button>
              <button onClick={() => edit({ ...values, lifecycle: 'Disposed' })}>폐기 상태로 변경</button>
              <button onClick={() => { if (historyPanel.current) { historyPanel.current.open = true; historyPanel.current.scrollIntoView({ block: 'nearest' }); } }}>변경·이동 기록 보기</button>
              <button onClick={() => { if (usagePanel.current) { usagePanel.current.open = true; usagePanel.current.scrollIntoView({ block: 'nearest' }); } }}>사용 이력 보기</button>
            </div></details></div>
        </div>
        <div className="mi-grid">
          {detail('기본 정보', [['물질명', material.name], ['CAS 번호', values.cas], ['회사명', values.manufacturer], ['Lot 번호', lot.name],
            ['용량', values.capacity && values.capacity + ' ' + values.unit], ['잔량', values.remaining && values.remaining + ' ' + values.unit]])}
          {detail('보관 및 사용', [['보관 위치', values.location], ['구매일', values.purchased], ['개봉일', values.opened || (values.unopened && lot.inventory ? '미개봉' : '')],
            ['상태', values.state], ['재고 상태', values.lifecycle], ['비고', values.notes]])}
          <div className="mi-properties">
            {detail('물성 및 문서', [['분자량 (g/mol)', values.mw], ['밀도 (g/cm³)', values.density], ['점도 (mPa·s)', values.viscosity],
              ['상변화점 (°C)', values.phaseValue && values.phase + ' ' + values.phaseValue], ['측정 온도 (°C)', values.measurementTemperature], ['측정 조건', values.measurementConditions],
              ['순도 (%)', values.purity]])}
            {values.msds ? <div className="mi-document"><FileText size={19}/><strong>{values.msds.name}</strong>
              <button onClick={() => viewPdf(values.msds!)}>보기</button>
              <a aria-label="MSDS 다운로드" href={values.msds.data} download={values.msds.name}><Download size={16}/></a></div>
              : <p className="ob-muted mi-no-document">MSDS 미등록</p>}
          </div>
        </div>
        <details className="ob-links" ref={usagePanel}><summary>사용 이력</summary>
          {hasUsage ? <ul>
            {linked.batches.map(batch => <li key={batch.id}><a href={'#oligomer-batches/' + encodeURIComponent(batch.id)}>{batch.id} · {batch.name}</a>
              {' · '}{batch.ingredients.filter(row => row.materialId === material.id && row.lotId === lot.id).map(row => row.amount ? row.amount + ' ' + row.unit : '사용량 미등록').join(', ')}</li>)}
            {linked.formulations.map(record => <li key={record.id + ':' + record.version}><a href="#formulation">{record.name} v{record.version}</a></li>)}
            {linked.syntheses.map(record => <li key={record.id}><a href={'#project/' + encodeURIComponent(record.projectId)}>합성 {record.id}</a></li>)}
            {linked.samples.map(sample => <li key={sample.id}>샘플 {sample.name}{sample.analysis && ' · 분석 ' + sample.analysis}</li>)}
          </ul> : <p className="ob-muted">연결된 실험 기록이 없습니다.</p>}
        </details>
        <details className="ob-links" ref={historyPanel}><summary>변경·이동 기록</summary>
          {lot.history?.length ? [...lot.history].reverse().map((entry, index) => <div className="ob-history" key={entry.date + index}>
            <strong>{new Date(entry.date).toLocaleString('ko-KR')}</strong>
            {entry.changes.map(change => <p key={change}>{change.replace(/^([^:]+):/, (_, key: string) => (titles[key as keyof typeof titles] ?? key) + ':')}</p>)}
          </div>) : <p className="ob-muted">변경 기록이 없습니다.</p>}
        </details>
      </section>;
    })()}
    {!draft && error && <p className="ob-error" role="alert">{error}</p>}
    {message && <p className="mi-message" role="status">{message}</p>}
  </section>;
}
