import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, FileText, Search } from 'lucide-react';
import { buildSearch, emptySearch, kinds, materialLink, searchResults, type Result, type SearchFilters, type SearchProject } from './research-search';
import './research-search.css';

const pageSize = 10;
const tabs = ['기본 정보', '합성 조건', '원료·Lot', '분석 결과'];
const sessionKey = 'isnm-search-state';
const initial = { filters: emptySearch, submitted: false, page: 1, selected: '', tab: 0, scroll: 0 };
type State = typeof initial;

function restore(): State {
  try { return { ...initial, ...JSON.parse(sessionStorage.getItem(sessionKey) ?? '{}') }; }
  catch { return initial; }
}

function fields(values: [string, string][]) {
  return <dl className="rs-fields">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>;
}

function analysis(result: Result): [string, string][] {
  const batch = result.batch;
  return batch ? [['Mn', batch.mn ? Number(batch.mn).toLocaleString('ko-KR') + ' g/mol' : ''], ['PDI', batch.pdi],
    ['Tni', batch.tni ? batch.tni + ' °C' : ''], ['비고', batch.notes], ['분석 참조', batch.analysisRefs]] : result.fields;
}

function recipe(result: Result): [string, string][] {
  const batch = result.batch;
  return batch ? [['모노머 조성비', batch.composition], ['조성 기준', batch.basis], ['촉매', batch.catalyst],
    ['촉매 함량', batch.catalystAmount ? batch.catalystAmount + ' wt%' : ''], ['반응 온도', batch.temperature ? batch.temperature + ' °C' : ''],
    ['반응 시간', batch.duration ? batch.duration + ' h' : ''], ['용매', batch.solvent], ['세척액', batch.wash]] : result.fields;
}

function ingredients(result: Result) {
  const rows = result.batch?.ingredients ?? result.rows ?? [];
  return rows.length ? <ul className="rs-links">{rows.map(row => <li key={row.id}><a href={materialLink(row.lotId)}>{row.name} · {row.lot}</a>
    <span>{row.amount ? row.amount + ' ' + row.unit : '사용량 미등록'}</span></li>)}</ul> : <p className="ob-muted">등록된 원료·Lot가 없습니다.</p>;
}

function status(result: Result) {
  return result.status ? <span className="ob-badge" data-status={result.status === '분석 완료' ? '완료' : result.status}>{result.status}</span> : '—';
}

export default function ResearchSearch({ projects, originalKey }: { projects: SearchProject[]; originalKey: string }) {
  const [state, setState] = useState(restore);
  const [filters, setFilters] = useState(state.filters);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(() => buildSearch(projects));
  const [error, setError] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const searchInput = useRef<HTMLInputElement>(null);
  const selected = data.results.find(result => result.key === state.selected);
  const original = data.results.find(result => encodeURIComponent(result.key) === originalKey);
  const results = state.submitted ? searchResults(data.results, state.filters) : [];
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const page = Math.min(state.page, pages);
  const visible = results.slice((page - 1) * pageSize, page * pageSize);
  const batchTable = results.length > 0 && results.every(result => result.kind === '올리고머 배치');
  const people = [...new Set(data.results.flatMap(result => result.researcher ? [result.researcher] : []))].sort();

  useEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo(0, originalKey ? 0 : state.scroll));
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer.current); };
  }, [originalKey]);

  function remember(next: State) {
    setState(next);
    try { sessionStorage.setItem(sessionKey, JSON.stringify(next)); } catch { /* In-memory search remains available. */ }
  }

  function run(next: SearchFilters) {
    window.clearTimeout(timer.current);
    setError('');
    if (next.period === 'custom' && next.start && next.end && next.start > next.end) {
      setLoading(false);
      setError('종료일은 시작일 이후여야 합니다.');
      return;
    }
    const submitted = Object.entries(next).some(([key, value]) => !['sort', 'start', 'end'].includes(key) && value.trim());
    setLoading(true);
    timer.current = window.setTimeout(() => {
      try {
        setData(buildSearch(projects));
        remember({ ...initial, filters: next, submitted });
      } catch { setError('검색 데이터를 읽지 못했습니다. 다시 검색해주세요.'); }
      finally { setLoading(false); }
    }, 0);
  }

  function filter(key: keyof SearchFilters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    run(next);
  }

  function highlight(value: string): ReactNode {
    const query = state.filters.query.trim();
    if (!query) return value;
    const index = value.toLowerCase().indexOf(query.toLowerCase());
    return index < 0 ? value : <>{value.slice(0, index)}<mark>{value.slice(index, index + query.length)}</mark>{value.slice(index + query.length)}</>;
  }

  function section(title: string, content: ReactNode) {
    return <section className="ob-list rs-section"><h2>{title}</h2>{content}</section>;
  }

  const capture = () => remember({ ...state, scroll: window.scrollY });

  if (originalKey) return <div className="ob-page rs-page">
    <a className="rs-back" href="#data-search"><ArrowLeft size={16}/> 검색 결과로 돌아가기</a>
    {original ? <>
      <div className="ob-heading"><div className="rs-title"><h1>{original.name}</h1><span className="ob-badge">{original.batch?.id ?? original.id}</span>
        {status(original)}{original.example && <small>예시</small>}</div>
        <a className="rs-action" href={original.source}><ArrowUpRight size={16}/> 관리 화면에서 열기</a></div>
      {section('기본 정보', fields(original.fields))}
      {original.batch && section('합성 레시피', fields(recipe(original)))}
      {original.batch && section('분석 결과', fields(analysis(original)))}
      <div className="rs-pair">
        {(original.batch || original.rows) && section('원료·Lot', ingredients(original))}
        {original.batch && section('첨부 파일', original.batch.attachments.length
          ? <ul className="rs-links">{original.batch.attachments.map(file => <li key={file.id}><FileText size={16}/><a href={file.data} download={file.name}>{file.name}</a></li>)}</ul>
          : <p className="ob-muted">등록된 첨부 파일이 없습니다.</p>)}
      </div>
    </> : section('원본 기록', <p className="ob-muted">이 기록을 현재 브라우저에서 찾을 수 없습니다.</p>)}
  </div>;

  return <section className="ob-page rs-page">
    <div className="ob-heading"><div><h1>데이터 검색</h1><p>프로젝트 실험 기록과 올리고머 합성·분석 결과를 찾아보세요.</p></div></div>
    <form className="rs-search" role="search" onSubmit={event => { event.preventDefault(); run(filters); }}
      onKeyDown={event => { if (event.key === 'Escape') { setFilters({ ...filters, query: '' }); searchInput.current?.focus(); } }}>
      <input ref={searchInput} aria-label="통합 검색어" value={filters.query} placeholder="프로젝트명, 올리고머명, Batch ID, 원료명 또는 Lot 검색"
        onChange={event => setFilters({ ...filters, query: event.target.value })}/>
      <button className="ob-primary" type="submit">검색</button>
    </form>
    <div className="ob-filters rs-filters">
      <label>프로젝트<select value={filters.project} onChange={event => filter('project', event.target.value)}>
        <option value="">전체</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>유형<select value={filters.kind} onChange={event => filter('kind', event.target.value)}>
        <option value="">전체</option>{kinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
      <label>연구자<select value={filters.researcher} onChange={event => filter('researcher', event.target.value)}>
        <option value="">전체</option>{people.map(person => <option key={person}>{person}</option>)}</select></label>
      <label>기간<select value={filters.period} onChange={event => filter('period', event.target.value)}>
        <option value="">전체 기간</option><option value="week">최근 7일</option><option value="month">최근 30일</option>
        <option value="quarter">최근 3개월</option><option value="half">최근 6개월</option><option value="year">최근 1년</option><option value="custom">사용자 지정</option></select></label>
      <label>분석 상태<select value={filters.status} onChange={event => filter('status', event.target.value)}>
        <option value="">전체</option>{['분석 전', '분석 대기', '분석 완료', '실패'].map(value => <option key={value}>{value}</option>)}</select></label>
      {filters.period === 'custom' && <div className="ob-range">
        <label>시작일<input type="date" value={filters.start} onChange={event => filter('start', event.target.value)}/></label>
        <label>종료일<input type="date" value={filters.end} onChange={event => filter('end', event.target.value)}/></label>
      </div>}
    </div>
    {error && <p className="ob-error" role="alert">{error}</p>}
    {!!data.warnings.length && <p className="ob-error" role="status">불러오지 못한 데이터 · {data.warnings.join(', ')}</p>}
    {loading || !state.submitted || !results.length ? <div className="ob-list rs-empty" role="status">
      <span><Search size={36}/></span><h2>{loading ? '검색 중…' : state.submitted ? '검색 결과가 없습니다.' : '검색어를 입력해 주세요.'}</h2>
      {state.submitted && !loading && <button onClick={() => { setFilters(emptySearch); run(emptySearch); searchInput.current?.focus(); }}>검색 조건 초기화</button>}
    </div> : <>
      <section className="ob-list" aria-labelledby="rs-results">
        <div className="ob-list-title"><h2 id="rs-results">검색 결과</h2><span role="status">총 {results.length}건</span>
          <label className="rs-sort">정렬<select value={filters.sort} onChange={event => filter('sort', event.target.value)}>
            <option value="relevance">관련도순</option><option value="new">최신순</option><option value="old">오래된순</option><option value="name">이름순</option></select></label></div>
        <div className="ob-scroll"><table><thead><tr>{(batchTable ? ['Batch ID', '올리고머명', '조성비', 'Mn (g/mol)', 'PDI', '상태']
          : ['유형', '이름 / 기록 ID', '요약', '연구자', '날짜', '상태']).map(value => <th key={value}>{value}</th>)}</tr></thead>
          <tbody>{visible.map(result => {
            const choose = () => remember({ ...state, selected: result.key, tab: result.kind === '분석 결과' ? 3 : 0, scroll: window.scrollY });
            const batch = result.batch;
            return <tr key={result.key} onClick={choose} className={selected?.key === result.key ? 'ob-active' : ''}>
              {batchTable && batch ? <>
                <td><button className="ob-link" aria-pressed={selected?.key === result.key}>{highlight(result.id)}</button></td>
                <td>{highlight(result.name)} {result.example && <small>예시</small>}</td><td>{highlight(batch.composition) || '—'}</td>
                <td className="ob-num">{batch.mn ? Number(batch.mn).toLocaleString('ko-KR') : '—'}</td><td className="ob-num">{batch.pdi || '—'}</td>
              </> : <>
                <td><span className="ob-badge">{result.kind}</span></td>
                <td><button className="ob-link" aria-pressed={selected?.key === result.key}>{highlight(result.name)}</button>
                  <small className="rs-id">{highlight(result.id)} {result.example && '· 예시'}</small></td>
                <td>{highlight(result.summary ?? '') || '—'}</td><td>{highlight(result.researcher ?? '') || '—'}</td><td>{result.date?.slice(0, 10) || '—'}</td>
              </>}
              <td>{status(result)}</td>
            </tr>;
          })}</tbody></table></div>
        {pages > 1 && <div className="ob-pagination rs-pages"><button disabled={page === 1} aria-label="이전 페이지" onClick={() => remember({ ...state, page: page - 1, selected: '' })}>‹</button>
          <span>{page} / {pages}</span><button disabled={page === pages} aria-label="다음 페이지" onClick={() => remember({ ...state, page: page + 1, selected: '' })}>›</button></div>}
      </section>
      {selected && <section className="ob-list rs-section" aria-label="선택한 기록 요약">
        <div className="ob-heading"><div className="rs-title"><h2>{selected.name}</h2><span className="ob-badge">{selected.batch?.id ?? selected.id}</span></div>
          <a className="rs-action" href={'#data-search/record/' + encodeURIComponent(selected.key)} onClick={capture}><ArrowUpRight size={16}/> 원본 기록 열기</a></div>
        {(selected.batch || selected.rows) ? <>
          <div className="rs-tabs" role="tablist" aria-label="기록 상세">
            {tabs.map((title, index) => <button role="tab" id={'rs-tab-' + index} aria-selected={state.tab === index} aria-controls="rs-tab-content"
              tabIndex={state.tab === index ? 0 : -1} key={title} onClick={() => remember({ ...state, tab: index })}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                  : (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
                remember({ ...state, tab: next });
                document.getElementById('rs-tab-' + next)?.focus();
              }}>{title}</button>)}
          </div>
          <div role="tabpanel" id="rs-tab-content" aria-labelledby={'rs-tab-' + state.tab}>
            {state.tab === 2 ? ingredients(selected) : fields(state.tab === 1 ? recipe(selected) : state.tab === 3 ? analysis(selected) : selected.fields)}
          </div>
        </> : fields(selected.fields)}
      </section>}
    </>}
  </section>;
}
