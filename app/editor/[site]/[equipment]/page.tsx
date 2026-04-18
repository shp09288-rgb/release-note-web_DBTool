'use client';

import { use, useEffect, useState, useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Props {
  params: Promise<{
    site: string;
    equipment: string;
  }>;
}

type SectionKey =
  | 'basic'
  | 'xea'
  | 'xes'
  | 'test'
  | 'notes'
  | 'history'
  | 'generate';

type DetailCategory = 'New Feature' | 'Improvement' | 'Bug Fix';

interface DetailRow {
  ref: string;
  category: DetailCategory;
  title: string;
  desc: string;
}

interface NoteRow {
  icon: '!' | 'i';
  text: string;
}

interface HistoryRow {
  date: string;
  xea: string;
  xes: string;
  cim: string;
  summary: string;
}

export default function EditorPage({ params }: Props) {
  const router = useRouter();

  const raw = use(params);
  const site = decodeURIComponent(raw.site);
  const equipment = decodeURIComponent(raw.equipment);
  const displaySite = site.replace(/_/g, ' ');
  
  const [activeSection, setActiveSection] = useState<SectionKey>('basic');

  const [date, setDate] = useState('');
  const [xeaBefore, setXeaBefore] = useState('');
  const [xeaAfter, setXeaAfter] = useState('');
  const [xesBefore, setXesBefore] = useState('');
  const [xesAfter, setXesAfter] = useState('');
  const [cimVer, setCimVer] = useState('');
  const [overview, setOverview] = useState<string[]>(['']);

  const [xeaDetails, setXeaDetails] = useState<DetailRow[]>([]);
  const [xesDetails, setXesDetails] = useState<DetailRow[]>([]);
  const [testVersions, setTestVersions] = useState<DetailRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [currentUser, setCurrentUser] = useState('');
  const [lockMessage, setLockMessage] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/load-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            site,
            equipment,
          }),
        });
  

        const result = await res.json();

        if (result.ok) {
          setDate(result.data.date || '');
          setXeaBefore(result.data.xeaBefore || '');
          setXeaAfter(result.data.xeaAfter || '');
          setXesBefore(result.data.xesBefore || '');
          setXesAfter(result.data.xesAfter || '');
          setCimVer(result.data.cimVer || '');

          setOverview(
            Array.isArray(result.data.overview) && result.data.overview.length > 0
              ? result.data.overview
              : ['']
          );

          setXeaDetails(
            Array.isArray(result.data.xeaDetails) ? result.data.xeaDetails : []
          );

          setXesDetails(
            Array.isArray(result.data.xesDetails) ? result.data.xesDetails : []
          );

          setTestVersions(
            Array.isArray(result.data.testVersions) ? result.data.testVersions : []
          );

          setNotes(
            Array.isArray(result.data.notes) ? result.data.notes : []
          );

          setHistory(
            Array.isArray(result.data.history) ? result.data.history : []
          );
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadData();
  }, [site, equipment]);

useEffect(() => {
  const key = 'rn_user_name';
  const existing = window.localStorage.getItem(key);
  const finalUser =
    (existing && existing.trim()) ||
    (window.prompt('에디터에서 사용할 이름을 입력하세요.', 'User01') || 'User01').trim() ||
    'User01';

  window.localStorage.setItem(key, finalUser);
  setCurrentUser(finalUser);

  const acquire = async () => {
    try {
      const res = await fetch('/api/acquire-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site,
          equipment,
          user: finalUser,
        }),
      });

      const result = await res.json();

      if (result.ok && result.acquired) {
        if (result.takenOver) {
          setLockMessage(`기존 stale lock을 ${finalUser} 사용자가 인계받았습니다.`);
        } else {
          setLockMessage(`${finalUser} 사용자가 현재 편집 중입니다.`);
        }
        setReadOnly(false);
      } else {
        const otherUser = result.lock?.user || '다른 사용자';
        setLockMessage(`${otherUser} 사용자가 현재 수정 중입니다. 읽기 전용으로 열립니다.`);
        setReadOnly(true);
      }
    } catch (err) {
      console.error(err);
      setLockMessage('락 상태 확인 실패. 읽기 전용으로 전환합니다.');
      setReadOnly(true);
    }
  };

  acquire();

  const handleBeforeUnload = () => {
    navigator.sendBeacon?.(
      '/api/release-lock',
      new Blob(
        [
          JSON.stringify({
            site,
            equipment,
            user: finalUser,
          }),
        ],
        { type: 'application/json' }
      )
    );
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);

    fetch('/api/release-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site,
        equipment,
        user: finalUser,
      }),
      keepalive: true,
    }).catch(() => {});
  };
}, [site, equipment]);

  const navItems: { key: SectionKey; label: string; num: string }[] = [
    { key: 'basic', label: '기본 정보', num: '1' },
    { key: 'xea', label: 'XEA 상세', num: '2' },
    { key: 'xes', label: 'XES 상세', num: '3' },
    { key: 'test', label: 'Test Version', num: '4' },
    { key: 'notes', label: 'Important Notes', num: '5' },
    { key: 'history', label: '업데이트 이력', num: '6' },
    { key: 'generate', label: '생성 & 다운로드', num: '✓' },
  ];

  const saveCurrent = async () => {
        if (readOnly) {
      alert('현재 읽기 전용 상태입니다. 다른 사용자가 수정 중입니다.');
      return;
    }
    const payload = {
      site,
      equipment,
      date,
      xeaBefore,
      xeaAfter,
      xesBefore,
      xesAfter,
      cimVer,
      overview,
      xeaDetails,
      xesDetails,
      testVersions,
      notes,
      history,
    };
    

    try {
      const res = await fetch('/api/test-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      alert(`저장 완료`);
      setIsDirty(false);
    } catch (err) {
      alert('저장 실패');
      console.error(err);
    }
  };

const releaseAndGoDashboard = async () => {
  try {
    console.log('[release] start', { site, equipment, currentUser });

    const res = await fetch('/api/release-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site,
        equipment,
        user: currentUser,
      }),
    });

    const result = await res.json();

    if (result.ok) {
      setIsDirty(false);
    }
    console.log('[release] result', result);

    if (!result.ok || result.released === false) {
      alert(
        `락 해제 실패\n` +
          JSON.stringify(result, null, 2)
      );
      return;
    }

    router.push('/dashboard');
  } catch (err) {
    console.error('release lock failed:', err);
    alert('release-lock 호출 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
  }
};
    const downloadDocx = async () => {
          if (readOnly) {
      alert('현재 읽기 전용 상태입니다. 다른 사용자가 수정 중입니다.');
      return;
    }
    const payload = {
      site,
      equipment,
      date,
      xeaBefore,
      xeaAfter,
      xesBefore,
      xesAfter,
      cimVer,
      overview,
      xeaDetails,
      xesDetails,
      testVersions,
      notes,
      history,
    };

    try {
      const res = await fetch('/api/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('DOCX generation failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const today = `${yyyy}-${mm}-${dd}`;

a.download = `${today}_${site}_${equipment}_ReleaseNote.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('DOCX 생성 실패');
      console.error(err);
    }
  };

  const hasMeaningfulContent = () => {
  const hasOverviewText = overview.some((item) => String(item || '').trim() !== '');
  const hasXea = String(xeaAfter || xeaBefore || '').trim() !== '';
  const hasXes = String(xesAfter || xesBefore || '').trim() !== '';
  const hasCim = String(cimVer || '').trim() !== '';
  const hasDate = String(date || '').trim() !== '';

  return hasOverviewText || hasXea || hasXes || hasCim || hasDate;
};

const buildHistorySnapshot = (): HistoryRow => {
  const summaryText = overview
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' / ');

  return {
    date: date || new Date().toISOString().slice(0, 10),
    xea: xeaAfter || xeaBefore || '',
    xes: xesAfter || xesBefore || '',
    cim: cimVer || '',
    summary: summaryText || '새 릴리즈 생성 전 자동 저장',
  };
};

const handleNewDocument = () => {
  if (readOnly) {
    alert('현재 읽기 전용 상태입니다. 다른 사용자가 수정 중입니다.');
    return;
  }

  const ok = window.confirm('현재 내용을 업데이트 이력에 추가하고 새 문서를 시작하시겠습니까?');
  if (!ok) return;

  if (hasMeaningfulContent()) {
    const snapshot = buildHistorySnapshot();
    setHistory((prev) => [snapshot, ...prev]);
  }

  const today = new Date().toISOString().slice(0, 10);

  setDate(today);
  setXeaBefore('');
  setXeaAfter('');
  setXesBefore('');
  setXesAfter('');
  setCimVer('');
  setOverview(['']);
  setXeaDetails([]);
  setXesDetails([]);
  setTestVersions([]);
  setNotes([]);
  // history는 유지
  // lock/readOnly/currentUser는 유지

  setActiveSection('basic');
  setIsDirty(true);
};
  

  const addOverviewRow = () => {
    setOverview((prev) => [...prev, '']);
    setIsDirty(true);
  };

  const updateOverviewRow = (index: number, value: string) => {
    setOverview((prev) => prev.map((item, i) => (i === index ? value : item)));
    setIsDirty(true);
  };

  const removeOverviewRow = (index: number) => {
    setOverview((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [''];
      setIsDirty(true);
    });
  };

  const addDetailRow = (
    setter: React.Dispatch<React.SetStateAction<DetailRow[]>>
  ) => {
    setter((prev) => [
      ...prev,
      {
        ref: '',
        category: 'Improvement',
        title: '',
        desc: '',
      },
    ]);
  };

  const updateDetailRow = (
    setter: React.Dispatch<React.SetStateAction<DetailRow[]>>,
    index: number,
    field: keyof DetailRow,
    value: string
  ) => {
    setter((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const removeDetailRow = (
    setter: React.Dispatch<React.SetStateAction<DetailRow[]>>,
    index: number
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const addNoteRow = () => {
    setNotes((prev) => [...prev, { icon: '!', text: '' }]);
  };

  const updateNoteRow = (
    index: number,
    field: keyof NoteRow,
    value: string
  ) => {
    setNotes((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const removeNoteRow = (index: number) => {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const addHistoryRow = () => {
    setHistory((prev) => [
      ...prev,
      {
        date: '',
        xea: '',
        xes: '',
        cim: '',
        summary: '',
      },
    ]);
  };

  const updateHistoryRow = (
    index: number,
    field: keyof HistoryRow,
    value: string
  ) => {
    setHistory((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const removeHistoryRow = (index: number) => {
    setHistory((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#eef1f7', color: '#222' }}>
      <div
        style={{
          background: '#1B3A6B',
          color: '#fff',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              overflow: 'hidden',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Image
              src="/park-mascot.png"
              alt="Park mascot"
              width={42}
              height={42}
              style={{ objectFit: 'cover' }}
            />
         </div>

        
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            SW Release Note Generator
           </div>
           <div style={{ fontSize: 11, color: '#cfe0ff' }}>
             Park Systems Corporation | Field Application Engineering
           </div>
         </div>
       </div>

      <div
        style={{
          margin: '16px 20px 0',
          padding: '12px 16px',
          borderRadius: 10,
          border: `1px solid ${readOnly ? '#f5c2c7' : '#cfe2ff'}`,
          background: readOnly ? '#f8d7da' : '#e7f1ff',
          color: readOnly ? '#842029' : '#084298',
          fontWeight: 700,
        }}
      >
        {lockMessage || '락 상태 확인 중...'}
      </div>       

       <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
  <button
    type="button"
    onClick={handleNewDocument}
    disabled={readOnly}
    title={readOnly ? '다른 사용자가 수정 중입니다' : ''}
    style={{
      background: '#ED7D31',
      color: '#fff',
      padding: '8px 14px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      border: 'none',
      cursor: 'pointer',
      opacity: readOnly ? 0.5 : 1,
      pointerEvents: readOnly ? 'none' : 'auto',
    }}
  >
    새로 만들기
  </button>

  <button
    type="button"
    onClick={releaseAndGoDashboard}
    style={{
      background: '#4472C4',
      color: '#fff',
      padding: '8px 14px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      border: 'none',
      cursor: 'pointer',
    }}
  >
    대시보드로 돌아가기
  </button>

  <div style={{ fontSize: 12, color: '#d7e6ff' }}>
    {displaySite} / {equipment}
  </div>
</div>
     </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 58px)' }}>
        <aside
          style={{
            width: 220,
            background: '#1B3A6B',
            padding: '18px 0',
            flexShrink: 0,
          }}
          
          
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.key;

            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 22px',
                  border: 'none',
                  background: isActive ? '#2E5FA3' : 'transparent',
                  color: isActive ? '#fff' : '#a8c4f0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderLeft: isActive ? '3px solid #7ba9e6' : '3px solid transparent',
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? '#4472C4' : '#2E5FA3',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {item.num}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
          <div style={{ padding: '18px 16px 0 16px' }}>
  <Link
    href="/dashboard"
    style={{
      display: 'block',
      width: '100%',
      textAlign: 'center',
      background: '#6F42C1',
      color: '#fff',
      textDecoration: 'none',
      padding: '10px 12px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
    }}
  >
    🏠 설비 대시보드
  </Link>
</div>
        </aside>

        <main style={{ flex: 1, padding: 24 }}>
          {activeSection === 'basic' && (
            <>
              <div
                style={{
                  background: 'linear-gradient(135deg, #1B3A6B 0%, #2E5FA3 100%)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: 20,
                  marginBottom: 18,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>SW Release Note</div>
                <div style={{ fontSize: 15, color: '#d7e6ff', lineHeight: 1.7 }}>
                  SW Release Note를 작성합니다.
                  <br />
                  최종 DOCX는 생성 날짜 기준으로 파일명이 생성됩니다.
                </div>
              </div>

              <section style={sectionStyle}>
                <h2 style={sectionTitleStyle}>📋기본 정보</h2>

                <div style={twoColGridStyle}>
                  <div>
                    <label style={labelStyle}>Site</label>
                    <input value={displaySite} readOnly style={readonlyInputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Release Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setIsDirty(true);
                      }}
                      style={inputStyle}
                      
                    />
                  </div>
                </div>

                <h3 style={subTitleStyle}>SW 버전 정보</h3>

                <div style={twoColGridStyle}>
                  <div>
                    <label style={labelStyle}>XEA Version (Before → After)</label>
                    <div style={arrowPairStyle}>
                      <input
                        value={xeaBefore}
                        onChange={(e) => {
                          setXeaBefore(e.target.value);
                          setIsDirty(true);
                        }}
                        placeholder="예: 5.2.5 Dev3475"
                        style={flexInputStyle}
                      />
                      <span style={arrowStyle}>→</span>
                      <input
                        value={xeaAfter}
                        onChange={(e) => {
                          setXeaAfter(e.target.value);
                          setIsDirty(true);
                        }}
                        placeholder="예: 5.2.5 Dev3584"
                        style={flexInputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>XES Version (Before → After)</label>
                    <div style={arrowPairStyle}>
                      <input
                        value={xesBefore}
                        onChange={(e) => {
                          setXesBefore(e.target.value);
                          setIsDirty(true);
                        }}
                        placeholder="예: 5.2.5 Dev1525"
                        style={flexInputStyle}
                      />
                      <span style={arrowStyle}>→</span>
                      <input
                        value={xesAfter}
                        onChange={(e) => {
                          setXesAfter(e.target.value);
                          setIsDirty(true);
                        }}
                        placeholder="예: 5.2.5 Dev1533"
                        style={flexInputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>CIM Version (없으면 비워두세요)</label>
                    <input
                      value={cimVer}
                      onChange={(e) => {
                        setCimVer(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="예: 20260310"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <h3 style={subTitleStyle}>
                  Release Overview (주요 Update 사항)
                </h3>

                <div style={{ marginBottom: 12 }}>
                  {overview.map((item, index) => (
                    <div key={index} style={rowInlineStyle}>
                      <span style={rowIndexStyle}>{index + 1}.</span>
                      <input
                        value={item}
                        onChange={(e) => updateOverviewRow(index, e.target.value)}
                        placeholder="고객 관점의 핵심 변경 내용"
                        style={rowInputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => removeOverviewRow(index)}
                        style={deleteBtnStyle}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={footerBtnRowStyle}>
                  <button type="button" onClick={addOverviewRow} style={subActionBtnStyle}>
                    + 요약 항목 추가
                  </button>

                  <button
  type="button"
  onClick={saveCurrent}
  disabled={readOnly}
  title={readOnly ? '다른 사용자가 수정 중입니다' : ''}
  style={{
    ...mainActionBtnStyle,
    opacity: readOnly ? 0.5 : 1,
    pointerEvents: readOnly ? 'none' : 'auto',
  }}
>
                    현재 내용 저장
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('xea')}
                    style={nextBtnStyle}
                  >
                    다음 ▶
                  </button>
                </div>
              </section>
            </>
          )}

          {activeSection === 'xea' && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>🔬XEA 상세</h2>

              <div style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => addDetailRow(setXeaDetails)}
                  style={subActionBtnStyle}
                >
                  + 항목 추가
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Reference</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Item</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {xeaDetails.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={emptyTdStyle}>
                          아직 등록된 XEA 상세 항목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      xeaDetails.map((row, index) => (
                        <tr key={index}>
                          <td style={tdStyle}>
                            <input
                              value={row.ref}
                              onChange={(e) =>
                                updateDetailRow(setXeaDetails, index, 'ref', e.target.value)
                              }
                              placeholder="예: PMS #4100"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <select
                              value={row.category}
                              onChange={(e) =>
                                updateDetailRow(
                                  setXeaDetails,
                                  index,
                                  'category',
                                  e.target.value
                                )
                              }
                              style={cellInputStyle}
                            >
                              <option value="New Feature">New Feature</option>
                              <option value="Improvement">Improvement</option>
                              <option value="Bug Fix">Bug Fix</option>
                            </select>
                          </td>

                          <td style={tdStyle}>
                            <input
                              value={row.title}
                              onChange={(e) =>
                                updateDetailRow(setXeaDetails, index, 'title', e.target.value)
                              }
                              placeholder="항목 제목"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <textarea
                              value={row.desc}
                              onChange={(e) =>
                                updateDetailRow(setXeaDetails, index, 'desc', e.target.value)
                              }
                              placeholder="고객용 설명"
                              style={{ ...cellInputStyle, minHeight: 70, resize: 'vertical' }}
                            />
                          </td>

                          <td style={tdStyle}>
                            <button
                              type="button"
                              onClick={() => removeDetailRow(setXeaDetails, index)}
                              style={deleteBtnStyle}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={footerBtnRowStyle}>
                <button
                  type="button"
                  onClick={() => setActiveSection('basic')}
                  style={prevBtnStyle}
                >
                  ◀ 이전
                </button>

                <button type="button" onClick={saveCurrent} style={mainActionBtnStyle}>
                  현재 내용 저장
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('xes')}
                  style={nextBtnStyle}
                >
                  다음 ▶
                </button>
              </div>
            </section>
          )}

          {activeSection === 'xes' && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>🔬XES 상세</h2>

              <div style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => addDetailRow(setXesDetails)}
                  style={subActionBtnStyle}
                >
                  + 항목 추가
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Reference</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Item</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {xesDetails.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={emptyTdStyle}>
                          아직 등록된 XES 상세 항목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      xesDetails.map((row, index) => (
                        <tr key={index}>
                          <td style={tdStyle}>
                            <input
                              value={row.ref}
                              onChange={(e) =>
                                updateDetailRow(setXesDetails, index, 'ref', e.target.value)
                              }
                              placeholder="예: PMS #4100"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <select
                              value={row.category}
                              onChange={(e) =>
                                updateDetailRow(
                                  setXesDetails,
                                  index,
                                  'category',
                                  e.target.value
                                )
                              }
                              style={cellInputStyle}
                            >
                              <option value="New Feature">New Feature</option>
                              <option value="Improvement">Improvement</option>
                              <option value="Bug Fix">Bug Fix</option>
                            </select>
                          </td>

                          <td style={tdStyle}>
                            <input
                              value={row.title}
                              onChange={(e) =>
                                updateDetailRow(setXesDetails, index, 'title', e.target.value)
                              }
                              placeholder="항목 제목"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <textarea
                              value={row.desc}
                              onChange={(e) =>
                                updateDetailRow(setXesDetails, index, 'desc', e.target.value)
                              }
                              placeholder="고객용 설명"
                              style={{ ...cellInputStyle, minHeight: 70, resize: 'vertical' }}
                            />
                          </td>

                          <td style={tdStyle}>
                            <button
                              type="button"
                              onClick={() => removeDetailRow(setXesDetails, index)}
                              style={deleteBtnStyle}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={footerBtnRowStyle}>
                <button
                  type="button"
                  onClick={() => setActiveSection('xea')}
                  style={prevBtnStyle}
                >
                  ◀ 이전
                </button>

                <button type="button" onClick={saveCurrent} style={mainActionBtnStyle}>
                  현재 내용 저장
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('test')}
                  style={nextBtnStyle}
                >
                  다음 ▶
                </button>
              </div>
            </section>
          )}

          {activeSection === 'test' && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>🧪Test Version</h2>

              <div style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => addDetailRow(setTestVersions)}
                  style={subActionBtnStyle}
                >
                  + 항목 추가
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Reference</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Item</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {testVersions.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={emptyTdStyle}>
                          아직 등록된 Test Version 항목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      testVersions.map((row, index) => (
                        <tr key={index}>
                          <td style={tdStyle}>
                            <input
                              value={row.ref}
                              onChange={(e) =>
                                updateDetailRow(setTestVersions, index, 'ref', e.target.value)
                              }
                              placeholder="예: PMS #9999"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <select
                              value={row.category}
                              onChange={(e) =>
                                updateDetailRow(
                                  setTestVersions,
                                  index,
                                  'category',
                                  e.target.value
                                )
                              }
                              style={cellInputStyle}
                            >
                              <option value="New Feature">New Feature</option>
                              <option value="Improvement">Improvement</option>
                              <option value="Bug Fix">Bug Fix</option>
                            </select>
                          </td>

                          <td style={tdStyle}>
                            <input
                              value={row.title}
                              onChange={(e) =>
                                updateDetailRow(setTestVersions, index, 'title', e.target.value)
                              }
                              placeholder="테스트 버전 제목"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <textarea
                              value={row.desc}
                              onChange={(e) =>
                                updateDetailRow(setTestVersions, index, 'desc', e.target.value)
                              }
                              placeholder="테스트 버전 설명"
                              style={{ ...cellInputStyle, minHeight: 70, resize: 'vertical' }}
                            />
                          </td>

                          <td style={tdStyle}>
                            <button
                              type="button"
                              onClick={() => removeDetailRow(setTestVersions, index)}
                              style={deleteBtnStyle}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={footerBtnRowStyle}>
                <button
                  type="button"
                  onClick={() => setActiveSection('xes')}
                  style={prevBtnStyle}
                >
                  ◀ 이전
                </button>

                <button type="button" onClick={saveCurrent} style={mainActionBtnStyle}>
                  현재 내용 저장
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('notes')}
                  style={nextBtnStyle}
                >
                  다음 ▶
                </button>
              </div>
            </section>
          )}

          {activeSection === 'notes' && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>📌Important Notes</h2>

              <div style={{ marginBottom: 14 }}>
                <button type="button" onClick={addNoteRow} style={subActionBtnStyle}>
                  + 항목 추가
                </button>
              </div>

              {notes.length === 0 ? (
                <div style={emptyBoxStyle}>아직 등록된 Important Notes가 없습니다.</div>
              ) : (
                notes.map((row, index) => (
                  <div key={index} style={noteRowWrapStyle}>
                    <select
                      value={row.icon}
                      onChange={(e) =>
                        updateNoteRow(index, 'icon', e.target.value as '!' | 'i')
                      }
                      style={{ ...cellInputStyle, width: 100 }}
                    >
                      <option value="!">[!]</option>
                      <option value="i">[i]</option>
                    </select>

                    <textarea
                      value={row.text}
                      onChange={(e) => updateNoteRow(index, 'text', e.target.value)}
                      placeholder="고객에게 전달할 중요 메모"
                      style={{
                        ...cellInputStyle,
                        minHeight: 80,
                        resize: 'vertical',
                        flex: 1,
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => removeNoteRow(index)}
                      style={deleteBtnStyle}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}

              <div style={footerBtnRowStyle}>
                <button
                  type="button"
                  onClick={() => setActiveSection('test')}
                  style={prevBtnStyle}
                >
                  ◀ 이전
                </button>

                <button type="button" onClick={saveCurrent} style={mainActionBtnStyle}>
                  현재 내용 저장
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('history')}
                  style={nextBtnStyle}
                >
                  다음 ▶
                </button>
              </div>
            </section>
          )}

          {activeSection === 'history' && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>🕘업데이트 이력</h2>

              <div style={{ marginBottom: 14 }}>
                <button type="button" onClick={addHistoryRow} style={subActionBtnStyle}>
                  + 이력 추가
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>XEA Ver.</th>
                      <th style={thStyle}>XES Ver.</th>
                      <th style={thStyle}>CIM</th>
                      <th style={thStyle}>주요 변경 내용</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={emptyTdStyle}>
                          아직 등록된 업데이트 이력이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      history.map((row, index) => (
                        <tr key={index}>
                          <td style={tdStyle}>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) =>
                                updateHistoryRow(index, 'date', e.target.value)
                              }
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <input
                              value={row.xea}
                              onChange={(e) =>
                                updateHistoryRow(index, 'xea', e.target.value)
                              }
                              placeholder="예: 5.2.5 Dev3584"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <input
                              value={row.xes}
                              onChange={(e) =>
                                updateHistoryRow(index, 'xes', e.target.value)
                              }
                              placeholder="예: 5.2.5 Dev1533"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <input
                              value={row.cim}
                              onChange={(e) =>
                                updateHistoryRow(index, 'cim', e.target.value)
                              }
                              placeholder="-"
                              style={cellInputStyle}
                            />
                          </td>

                          <td style={tdStyle}>
                            <textarea
                              value={row.summary}
                              onChange={(e) =>
                                updateHistoryRow(index, 'summary', e.target.value)
                              }
                              placeholder="주요 변경 내용"
                              style={{ ...cellInputStyle, minHeight: 80, resize: 'vertical' }}
                            />
                          </td>

                          <td style={tdStyle}>
                            <button
                              type="button"
                              onClick={() => removeHistoryRow(index)}
                              style={deleteBtnStyle}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={footerBtnRowStyle}>
                <button
                  type="button"
                  onClick={() => setActiveSection('notes')}
                  style={prevBtnStyle}
                >
                  ◀ 이전
                </button>

                <button type="button" onClick={saveCurrent} style={mainActionBtnStyle}>
                  현재 내용 저장
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('generate')}
                  style={nextBtnStyle}
                >
                  다음 ▶
                </button>
              </div>
            </section>
          )}

          {activeSection === 'generate' && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>📦생성 & 다운로드</h2>

              <div style={{ color: '#555', lineHeight: 1.8, marginBottom: 18 }}>
                현재 내용 저장을 클릭하고 DOCX 다운로드를 클릭하여 파일을 생성하세요.              
              </div>

              <div style={footerBtnRowStyle}>
                <button
                  type="button"
                  onClick={() => setActiveSection('history')}
                  style={prevBtnStyle}
                >
                  ◀ 이전
                </button>

                <button type="button" onClick={saveCurrent} style={mainActionBtnStyle}>
                  현재 내용 저장
                </button>

                <button
                  type="button"
                  onClick={downloadDocx}
                  disabled={readOnly}
                  title={readOnly ? '다른 사용자가 수정 중입니다' : ''}
                  style={{
                    ...nextBtnStyle,
                    opacity: readOnly ? 0.5 : 1,
                    pointerEvents: readOnly ? 'none' : 'auto',
                  }}
                >
                  DOCX 다운로드
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: 24,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  color: '#1B3A6B',
  marginBottom: 18,
  paddingBottom: 10,
  borderBottom: '2px solid #1B3A6B',
};

const subTitleStyle: CSSProperties = {
  fontSize: 14,
  color: '#2E5FA3',
  marginBottom: 10,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontWeight: 700,
  fontSize: 12,
  marginBottom: 6,
};

const twoColGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
  marginBottom: 18,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: 10,
  border: '1px solid #ccd3e0',
  borderRadius: 6,
  background: '#fafbfd',
};

const readonlyInputStyle: CSSProperties = {
  width: '100%',
  padding: 10,
  border: '1px solid #ccd3e0',
  borderRadius: 6,
  background: '#f5f7fb',
};

const arrowPairStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
};

const flexInputStyle: CSSProperties = {
  flex: 1,
  padding: 10,
  border: '1px solid #ccd3e0',
  borderRadius: 6,
  background: '#fafbfd',
};

const arrowStyle: CSSProperties = {
  color: '#2E5FA3',
  fontWeight: 700,
};

const rowInlineStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginBottom: 8,
};

const rowIndexStyle: CSSProperties = {
  minWidth: 18,
  color: '#4472C4',
  fontWeight: 700,
};

const rowInputStyle: CSSProperties = {
  flex: 1,
  padding: 10,
  border: '1px solid #ccd3e0',
  borderRadius: 6,
  background: '#fafbfd',
};

const subActionBtnStyle: CSSProperties = {
  background: '#4472C4',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 700,
};

const mainActionBtnStyle: CSSProperties = {
  background: '#1B3A6B',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 700,
};

const prevBtnStyle: CSSProperties = {
  background: '#4472C4',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '10px 16px',
  cursor: 'pointer',
  fontWeight: 700,
};

const nextBtnStyle: CSSProperties = {
  marginLeft: 'auto',
  background: '#4472C4',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '10px 18px',
  cursor: 'pointer',
  fontWeight: 700,
};

const deleteBtnStyle: CSSProperties = {
  background: '#c00000',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
};

const footerBtnRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 18,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: CSSProperties = {
  background: '#1B3A6B',
  color: '#fff',
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 700,
  border: '1px solid #d9e2ef',
};

const tdStyle: CSSProperties = {
  padding: 8,
  borderBottom: '1px solid #e8ecf4',
  verticalAlign: 'top',
  background: '#fff',
};

const emptyTdStyle: CSSProperties = {
  padding: 16,
  borderBottom: '1px solid #e8ecf4',
  color: '#666',
  textAlign: 'center',
  background: '#fafbfd',
};

const cellInputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #dde3ef',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 12,
  background: '#fafbfd',
  fontFamily: 'Arial, sans-serif',
};

const noteRowWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  marginBottom: 10,
};

const emptyBoxStyle: CSSProperties = {
  padding: 16,
  border: '1px solid #e8ecf4',
  background: '#fafbfd',
  borderRadius: 6,
  color: '#666',
};