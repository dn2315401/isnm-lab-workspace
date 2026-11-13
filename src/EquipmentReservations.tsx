import { useEffect, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, FileText, FlaskConical, Microscope, Plus, Video } from 'lucide-react';
import type { ResearchStore } from './calculator-model';
import {
  bookingKey, clock, currentResearcher, dateKey, defaults, endOf, equipmentKey, forEquipment, initialBookings, maintenanceKey,
  minutes, ownsBooking, readList, reservationError, writeSchedule, type Booking, type Condition, type Equipment, type Maintenance,
} from './equipment-bookings';
import './equipment-reservations.css';

const icons = { dma: Activity, microscope: Microscope, synthesis: FlaskConical, thermal: Video };
const conditions: Condition[] = ['미확인', '정상', '이상 있음'];
const adminKey = 'isnm-equipment-demo-admin';
type Project = { id: number; name: string };

export default function EquipmentReservations({ projects, onChange }: { projects: Project[]; onChange: (items: Booking[]) => void }) {
  const [equipment, setEquipment] = useState(defaults);
  const [bookings, setBookings] = useState(initialBookings);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [selected, setSelected] = useState('');
  const [step, setStep] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [date, setDate] = useState('');
  const [draft, setDraft] = useState<Booking | null>(null);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [manual, setManual] = useState<Equipment | null>(null);
  const [config, setConfig] = useState<Equipment | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [samples, setSamples] = useState<ResearchStore['samples']>([]);

  function refresh() {
    try {
      const records = readList(bookingKey, initialBookings);
      const catalog = readList(equipmentKey, defaults);
      const legacy = [...new Set(records.filter(item => !item.equipmentId).map(item => item.name))].filter(name => !catalog.some(item => item.name === name));
      setEquipment([...catalog, ...legacy.map(name => ({ ...defaults[0], id: 'legacy:' + name, name, description: '기존 예약 장비', icon: '' }))]);
      setBookings(records);
      setMaintenance(readList<Maintenance>(maintenanceKey, []));
      setAdmin(sessionStorage.getItem(adminKey) === 'true');
      try { setSamples((JSON.parse(localStorage.getItem('isnm-research-v1') ?? 'null') as ResearchStore | null)?.samples ?? []); } catch { setSamples([]); }
    } catch { setError('저장된 장비 일정을 불러오지 못했습니다.'); }
  }
  useEffect(() => {
    refresh();
    const sync = (event: StorageEvent) => { if ([bookingKey, equipmentKey, maintenanceKey].includes(event.key ?? '')) refresh(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const device = equipment.find(item => item.id === selected);
  const now = new Date();
  const today = dateKey(now);
  const deadline = new Date(now);
  deadline.setDate(now.getDate() + (device?.advance ?? 0));
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const dates = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => new Date(year, monthIndex, index - offset + 1));
  const active = device ? bookings.filter(item => !item.cancelled && forEquipment(item, device)) : [];
  const times = device ? Array.from({ length: 1 + Math.floor((minutes(device.closes) - minutes(device.opens)) / device.step) },
    (_, index) => clock(minutes(device.opens) + index * device.step)) : [];

  function canLeave() {
    return !busy && (!dirty || window.confirm('작성 중인 예약 정보를 삭제하시겠습니까?'));
  }
  function reset() { setDraft(null); setDetail(null); setDirty(false); setError(''); setMaintenanceForm(false); }
  function selectDay(day: string) {
    if (!device || !canLeave()) return;
    reset();
    setDate(day);
    if (day < today || day > dateKey(deadline) || !device.reservable) return;
    const base: Booking = {
      id: crypto.randomUUID(), equipmentId: device.id, name: device.name, date: day, time: '',
      end: '', person: currentResearcher, owner: currentResearcher, condition: '미확인', mode: '', memo: '',
    };
    const first = times.slice(0, -1).find((time, index) => !reservationError({ ...base, time, end: times[index + 1], mode: '측정' }, device, bookings, maintenance, now));
    if (first) setDraft({ ...base, time: first, end: clock(minutes(first) + device.step) });
    else setError('선택한 날짜에 예약할 수 있는 시간이 없습니다.');
  }
  function editDraft(values: Partial<Booking>) {
    setDraft(previous => previous && { ...previous, ...values });
    setDirty(true);
  }
  function openBooking(item: Booking) {
    if (!canLeave()) return;
    reset(); setDate(item.date); setDetail(item);
  }
  async function save(cancel = false) {
    const item = cancel ? detail : draft;
    if (!item || !device || busy) return;
    if (cancel && !window.confirm('예약을 취소하시겠습니까?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await writeSchedule(() => {
        const records = readList(bookingKey, initialBookings);
        const previous = records.find(record => record.id === item.id);
        if ((cancel || detail) && (!previous || previous.cancelled || (previous.revision ?? 0) !== (item.revision ?? 0))) {
          throw new Error('예약이 변경되었습니다. 일정을 다시 열어주세요.');
        }
        if (previous && !ownsBooking(previous) && !admin) throw new Error('본인의 예약만 변경할 수 있습니다.');
        if (!cancel) {
          const latest = readList(equipmentKey, defaults).find(record => record.id === device.id) ?? device;
          const problem = reservationError(item, latest, records, readList<Maintenance>(maintenanceKey, []));
          if (problem) throw new Error(problem);
        }
        const saved = { ...item, equipmentId: device.id, owner: item.owner ?? item.person, revision: (previous?.revision ?? 0) + 1, cancelled: cancel };
        const updated = previous ? records.map(record => record.id === item.id ? saved : record) : [...records, saved];
        localStorage.setItem(bookingKey, JSON.stringify(updated));
        return updated;
      });
      setBookings(next); onChange(next); reset();
      setMessage(cancel ? '예약을 취소했습니다.' : '예약을 저장했습니다.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '예약을 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  async function saveEquipment() {
    if (!admin || !config || busy) return;
    setBusy(true); setError('');
    try {
      const settings = { ...config, name: config.name.trim(), description: config.description.trim(), manual: config.manual.trim() };
      if (!settings.name || !settings.description || !settings.opens || !settings.closes || minutes(settings.opens) >= minutes(settings.closes)
        || (minutes(settings.closes) - minutes(settings.opens)) % settings.step || !Number.isInteger(settings.maximum) || settings.maximum < settings.step
        || !Number.isInteger(settings.advance) || settings.advance < 0) throw new Error('장비명, 설명과 운영 시간 설정을 확인해주세요.');
      if (settings.manual && !/^https?:\/\//i.test(settings.manual)) throw new Error('매뉴얼의 HTTP 또는 HTTPS 주소를 입력해주세요.');
      await writeSchedule(() => {
        const records = readList(equipmentKey, defaults);
        if (records.some(item => item.id !== settings.id && item.name.toLowerCase() === settings.name.toLowerCase())) throw new Error('이미 등록된 장비명입니다.');
        const updated = records.some(item => item.id === settings.id)
          ? records.map(item => item.id === settings.id ? settings : item) : [...records, settings];
        localStorage.setItem(equipmentKey, JSON.stringify(updated));
      });
      setConfig(null); refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '장비를 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  async function addMaintenance(form: FormData) {
    if (!admin || !device || !date || busy) return;
    const item = { id: crypto.randomUUID(), equipmentId: device.id, date, start: String(form.get('start')), end: String(form.get('end')), note: String(form.get('note')).trim() };
    setBusy(true); setError('');
    try {
      if (!item.start || !item.end || item.start >= item.end) throw new Error('점검 시간을 확인해주세요.');
      await writeSchedule(() => {
        if (readList(bookingKey, initialBookings).some(record => !record.cancelled && forEquipment(record, device)
          && record.date === date && item.start < endOf(record) && item.end > record.time)) throw new Error('점검 시간이 기존 예약과 겹칩니다.');
        const records = readList<Maintenance>(maintenanceKey, []);
        if (records.some(record => record.equipmentId === device.id && record.date === date
          && item.start < record.end && item.end > record.start)) throw new Error('기존 점검 일정과 겹칩니다.');
        localStorage.setItem(maintenanceKey, JSON.stringify([...records, item]));
      });
      refresh(); setMaintenanceForm(false); setMessage('점검 일정을 등록했습니다.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '점검 일정을 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  return <section className="ob-page eq-page">
    <div className="eq-steps" aria-label="예약 단계">
      <button aria-current={!step ? 'step' : undefined} onClick={() => { if (canLeave()) { reset(); setStep(false); } }}>01　장비 선택</button><ArrowRight size={20}/>
      <button aria-current={step ? 'step' : undefined} disabled={!device} onClick={() => setStep(true)}>02　예약 일정</button>
    </div>
    {!step || !device ? <>
      <div className="ob-heading"><div><h1>어떤 장비를 예약할까요?</h1><p>장비를 선택한 후 예약 일정을 확인하세요.</p></div>
        {admin && <button onClick={() => setConfig({ ...defaults[0], id: crypto.randomUUID(), name: '', description: '', icon: '', manual: '' })}><Plus size={16}/> 장비 추가</button>}</div>
      <div className="eq-cards">{equipment.map(item => {
        const Icon = icons[item.icon as keyof typeof icons] ?? CalendarDays;
        return <article className={selected === item.id ? 'eq-card eq-selected' : 'eq-card'} key={item.id}>
          <button className="eq-pick" onClick={() => { setSelected(item.id); setStep(true); setDate(''); reset(); }}>
            <Icon size={57} strokeWidth={1.4}/><span><strong>{item.name}</strong><small>{item.description}</small>
              {!item.reservable && <small className="eq-blocked">예약 불가</small>}</span>{selected === item.id && <Check className="eq-check" size={18}/>}
          </button>
          <div className="eq-card-footer"><button onClick={() => setManual(item)}><FileText size={16}/> 장비 매뉴얼 <ArrowUpRight size={14}/></button>
            {admin && <button onClick={() => setConfig(item)}>장비 설정</button>}</div>
        </article>;
      })}</div>
      <details className="eq-local-admin"><summary>미리보기 관리 기능</summary>
        <label><input type="checkbox" checked={admin} onChange={event => { setAdmin(event.target.checked); sessionStorage.setItem(adminKey, String(event.target.checked)); }}/> 관리자 화면 체험</label>
      </details>
    </> : <>
      <div className="ob-heading"><div><h1>{device.name} 예약 일정</h1><p>날짜를 선택해 예약하거나 기존 예약을 확인하세요.</p></div>
        <button onClick={() => setManual(device)}><FileText size={16}/> 장비 매뉴얼</button></div>
      <div className="eq-layout">
        <section className="ob-list eq-calendar">
          <div className="eq-month">
            <button aria-label="이전 달" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ChevronLeft size={17}/></button>
            <button aria-label="다음 달" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ChevronRight size={17}/></button>
            <button onClick={() => { setMonth(now); selectDay(today); }}>오늘</button><h2>{year}년 {monthIndex + 1}월</h2>
          </div>
          <div className="eq-grid">
            {'일월화수목금토'.split('').map(label => <div className="eq-weekday" key={label}>{label}</div>)}
            {dates.map(day => {
              const key = dateKey(day);
              const items = active.filter(item => item.date === key).sort((a, b) => a.time.localeCompare(b.time));
              const blocks = maintenance.filter(item => item.equipmentId === device.id && item.date === key);
              return <div key={key} className={['eq-day', key === date ? 'eq-day-selected' : '', day.getMonth() !== monthIndex ? 'eq-outside' : ''].join(' ')}>
                <button className={key === today ? 'eq-today' : ''} aria-label={key + ' 날짜 선택'} aria-pressed={key === date} onClick={() => selectDay(key)}>{day.getDate()}</button>
                {items.slice(0, 2).map(item => <button key={item.id} className={'eq-event' + (ownsBooking(item) ? ' eq-own' : '')}
                  title={item.person + ' ' + item.time + '–' + endOf(item)} onClick={() => openBooking(item)}>{item.person.slice(-2)} {item.time}–{endOf(item)}</button>)}
                {!!blocks.length && <button className="eq-event eq-maint" onClick={() => selectDay(key)}>점검 {blocks.length}건</button>}
                {items.length > 2 && <button className="eq-more" onClick={() => selectDay(key)}>+{items.length - 2}건</button>}
              </div>;
            })}
          </div>
        </section>
        {date && <section className="ob-list eq-side">
          <h2>{draft ? detail ? '예약 수정' : '새 예약' : detail ? '예약 상세' : '선택한 날짜'}</h2>
          <p className="ob-muted">{new Date(date + 'T12:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
          <div className="eq-day-list">{active.filter(item => item.date === date).sort((a, b) => a.time.localeCompare(b.time)).map(item =>
            <button key={item.id} onClick={() => openBooking(item)}>{item.time}–{endOf(item)} · {item.person}</button>)}
            {maintenance.filter(item => item.equipmentId === device.id && item.date === date).map(item =>
              <p key={item.id} className="eq-maint">점검 {item.start}–{item.end} {item.note}</p>)}</div>
          {draft ? <form onSubmit={event => { event.preventDefault(); void save(); }}>
            <fieldset disabled={busy}>
              <label className="ob-field">사용자<input value={draft.person} readOnly/></label>
              <div className="eq-pair">{(['time', 'end'] as const).map(key => <label key={key} className="ob-field">{key === 'time' ? '시작 시간' : '종료 시간'}
                <select value={draft[key] ?? ''} onChange={event => editDraft({ [key]: event.target.value })}>
                  {times.filter((_, index) => key === 'time' ? index < times.length - 1 : index > 0).map(time => <option key={time}>{time}</option>)}</select></label>)}</div>
              <label className="ob-field">측정 모드<input required value={draft.mode ?? ''} onChange={event => editDraft({ mode: event.target.value })} placeholder="예: Tension, Temperature sweep"/></label>
              <div className="ob-field"><span>장비 상태</span><div className="eq-conditions">
                {conditions.map(value => <button key={value} type="button" aria-pressed={draft.condition === value} onClick={() => editDraft({ condition: value })}>{value}</button>)}
              </div></div>
              <label className="ob-field">메모<textarea rows={3} value={draft.memo ?? ''} onChange={event => editDraft({ memo: event.target.value })}/></label>
              <details><summary>프로젝트·샘플 연결</summary>
                <label className="ob-field">프로젝트<select value={draft.projectId ?? ''} onChange={event => editDraft({ projectId: event.target.value, sampleId: '' })}>
                  <option value="">선택 안 함</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                <label className="ob-field">샘플<select value={draft.sampleId ?? ''} onChange={event => editDraft({ sampleId: event.target.value })}>
                  <option value="">선택 안 함</option>{samples.filter(sample => !draft.projectId || sample.projectId === draft.projectId).map(sample => <option key={sample.id} value={sample.id}>{sample.name || sample.id}</option>)}</select></label>
                <label className="ob-field">분석 기록 ID<input value={draft.analysisRef ?? ''} onChange={event => editDraft({ analysisRef: event.target.value })}/></label>
              </details>
              <p className="ob-muted">{device.opens}–{device.closes} · {device.step}분 단위 · 최대 {device.maximum}분</p>
              <button className="ob-primary" type="submit">{busy ? '저장 중…' : detail ? '변경 저장' : '예약하기'}</button>
              <button type="button" onClick={() => { if (canLeave()) reset(); }}>취소</button>
            </fieldset>
          </form> : detail ? <>
            <dl className="eq-detail"><dt>사용자</dt><dd>{detail.person}</dd><dt>예약 시간</dt><dd>{detail.time}–{endOf(detail)}</dd>
              {(ownsBooking(detail) || admin) && <><dt>측정 모드</dt><dd>{detail.mode || '—'}</dd><dt>장비 상태</dt><dd>{detail.condition || '미확인'}</dd>
                <dt>메모</dt><dd>{detail.memo || '—'}</dd></>}</dl>
            {(ownsBooking(detail) || admin) && <div className="eq-pair"><button disabled={busy} onClick={() => setDraft({ ...detail, end: endOf(detail), condition: detail.condition ?? '미확인' })}>수정</button>
              <button disabled={busy} onClick={() => void save(true)}>예약 취소</button></div>}
            <button onClick={() => selectDay(date)}>이 날짜에 새 예약</button>
          </> : <p className="ob-muted">{date < today ? '지난 날짜의 일정입니다.' : !device.reservable ? '현재 예약할 수 없는 장비입니다.'
            : date > dateKey(deadline) ? '예약 가능 기간을 벗어났습니다.' : '날짜를 다시 선택해 새 예약을 시작하세요.'}</p>}
          {admin && !draft && <><button className="eq-maint-action" onClick={() => setMaintenanceForm(!maintenanceForm)}>점검 일정 추가</button>
            {maintenanceForm && <form onSubmit={event => { event.preventDefault(); void addMaintenance(new FormData(event.currentTarget)); }}>
              <div className="eq-pair"><label className="ob-field">시작<input name="start" type="time" defaultValue={device.opens} required/></label>
                <label className="ob-field">종료<input name="end" type="time" defaultValue={device.closes} required/></label></div>
              <label className="ob-field">점검 메모<input name="note"/></label><button disabled={busy}>점검 저장</button>
            </form>}</>}
        </section>}
      </div>
    </>}
    {manual && <div className="eq-overlay" onClick={() => setManual(null)}><section className="ob-list" role="dialog" aria-modal="true" aria-label="장비 매뉴얼" onClick={event => event.stopPropagation()}>
      <h2>{manual.name} 매뉴얼</h2><p>{manual.description}</p>
      {/^https?:\/\//i.test(manual.manual) ? <a href={manual.manual} target="_blank" rel="noreferrer">장비 매뉴얼 열기 ↗</a> : <p className="ob-muted">등록된 매뉴얼이 없습니다.</p>}
      <button autoFocus onClick={() => setManual(null)}>닫기</button>
    </section></div>}
    {config && <div className="eq-overlay"><form className="ob-list" role="dialog" aria-modal="true" aria-label="장비 설정" onSubmit={event => { event.preventDefault(); void saveEquipment(); }}>
      <h2>장비 설정</h2><fieldset disabled={busy}>
        {(['name', 'description', 'manual', 'opens', 'closes', 'maximum', 'advance'] as const).map((key, index) =>
          <label className="ob-field" key={key}>{['장비명', '사용 목적', '매뉴얼 URL', '운영 시작', '운영 종료', '최대 예약 (분)', '예약 가능 기간 (일)'][index]}
            <input type={key === 'opens' || key === 'closes' ? 'time' : typeof config[key] === 'number' ? 'number' : 'text'}
              value={config[key]} onChange={event => setConfig({ ...config, [key]: typeof config[key] === 'number' ? Number(event.target.value) : event.target.value })}/></label>)}
        <label className="ob-field">예약 단위<select value={config.step} onChange={event => setConfig({ ...config, step: Number(event.target.value) })}>
          {[15, 30, 60].map(value => <option key={value} value={value}>{value}분</option>)}</select></label>
        <label><input type="checkbox" checked={config.reservable} onChange={event => setConfig({ ...config, reservable: event.target.checked })}/> 예약 가능</label>
        {error && <p className="ob-error" role="alert">{error}</p>}
        <div className="eq-pair"><button type="button" onClick={() => { setConfig(null); setError(''); }}>취소</button><button className="ob-primary">저장</button></div>
      </fieldset>
    </form></div>}
    {error && !config && <p className="ob-error" role="alert">{error}</p>}
    {message && <p className="eq-message" role="status">{message}</p>}
  </section>;
}
