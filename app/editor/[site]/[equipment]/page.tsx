'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardToast, type ToastState } from '@/components/dashboard/dashboard-toast';
import { EditorHeader } from '@/components/editor/editor-header';
import { EditorMobileNav } from '@/components/editor/editor-mobile-nav';
import { EditorSidebar } from '@/components/editor/editor-sidebar';
import { LockStatusBanner } from '@/components/editor/lock-status-banner';
import {
  PreviewLayout,
} from '@/components/editor/preview/preview-layout';
import {
  usePreviewCollapsed,
  usePreviewPanelWidth,
} from '@/components/editor/preview/preview-panel';
import type {
  EditorViewMode,
  ReleaseNotePreviewData,
} from '@/components/editor/preview/preview-types';
import { BasicInfoSection } from '@/components/editor/sections/basic-info-section';
import { DetailTableSection } from '@/components/editor/sections/detail-table-section';
import { GenerateSection } from '@/components/editor/sections/generate-section';
import { HistorySection } from '@/components/editor/sections/history-section';
import { NotesSection } from '@/components/editor/sections/notes-section';
import {
  normalizeUserName,
  USER_NAME_STORAGE_KEY,
  type DetailRow,
  type HistoryRow,
  type NoteRow,
  type SectionKey,
} from '@/components/editor/types';

interface Props {
  params: Promise<{
    site: string;
    equipment: string;
  }>;
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
  // Reserved for future unsaved-changes UX; toggled on edits and after save.
  const [, setIsDirty] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [mobileViewMode, setMobileViewMode] = useState<EditorViewMode>('edit');

  const showToast = useCallback((message: string, type: NonNullable<ToastState>['type']) => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/load-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site, equipment }),
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
          setXeaDetails(Array.isArray(result.data.xeaDetails) ? result.data.xeaDetails : []);
          setXesDetails(Array.isArray(result.data.xesDetails) ? result.data.xesDetails : []);
          setTestVersions(Array.isArray(result.data.testVersions) ? result.data.testVersions : []);
          setNotes(Array.isArray(result.data.notes) ? result.data.notes : []);
          setHistory(Array.isArray(result.data.history) ? result.data.history : []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadData();
  }, [site, equipment]);

  useEffect(() => {
    const existing = window.localStorage.getItem(USER_NAME_STORAGE_KEY);
    const finalUser =
      existing && existing.trim()
        ? existing.trim()
        : normalizeUserName(window.prompt('에디터에서 사용할 이름을 입력하세요.', 'User01'));

    window.localStorage.setItem(USER_NAME_STORAGE_KEY, finalUser);

    let ownsLock = false;

    const acquire = async () => {
      try {
        const res = await fetch('/api/acquire-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site, equipment, user: finalUser }),
        });

        const result = await res.json();

        if (result.ok && result.acquired) {
          if (result.takenOver) {
            setLockMessage(`기존 stale lock을 ${finalUser} 사용자가 인계받았습니다.`);
          } else {
            setLockMessage(`${finalUser} 사용자가 현재 편집 중입니다.`);
          }
          ownsLock = true;
          setReadOnly(false);
        } else {
          const otherUser = result.lock?.user || '다른 사용자';
          setLockMessage(`${otherUser} 사용자가 현재 수정 중입니다. 읽기 전용으로 열립니다.`);
          ownsLock = false;
          setReadOnly(true);
        }
      } catch (err) {
        console.error(err);
        setLockMessage('락 상태 확인 실패. 읽기 전용으로 전환합니다.');
        ownsLock = false;
        setReadOnly(true);
      }
    };

    const initTimer = window.setTimeout(() => {
      setCurrentUser(finalUser);
      acquire();
    }, 0);

    const heartbeatTimer = window.setInterval(() => {
      if (ownsLock) {
        acquire();
      }
    }, 1000 * 60 * 2);

    const handleBeforeUnload = () => {
      navigator.sendBeacon?.(
        '/api/release-lock',
        new Blob([JSON.stringify({ site, equipment, user: finalUser })], {
          type: 'application/json',
        })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearTimeout(initTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.clearInterval(heartbeatTimer);

      fetch('/api/release-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, equipment, user: finalUser }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [site, equipment]);

  const handleChangeUserName = () => {
    const input = window.prompt(
      '저장/편집 이력에 표시할 사용자 이름을 입력하세요.',
      currentUser || 'User01'
    );
    if (input === null) return;

    const nextUser = normalizeUserName(input);
    window.localStorage.setItem(USER_NAME_STORAGE_KEY, nextUser);
    setCurrentUser(nextUser);
    showToast(
      `사용자 이름이 '${nextUser}'(으)로 변경되었습니다. 이미 잡힌 편집 락은 페이지를 다시 열면 새 이름으로 갱신됩니다.`,
      'info'
    );
  };

  const saveCurrent = async () => {
    if (readOnly) {
      showToast('현재 읽기 전용 상태입니다. 다른 사용자가 수정 중입니다.', 'error');
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
      updatedBy: currentUser || 'Anonymous',
    };

    try {
      const res = await fetch('/api/test-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!result.ok) {
        throw new Error(result.message || '저장 실패');
      }
      showToast('저장 완료', 'success');
      setIsDirty(false);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : '저장 실패', 'error');
    }
  };

  const releaseAndGoDashboard = async () => {
    try {
      const res = await fetch('/api/release-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, equipment, user: currentUser }),
      });

      const result = await res.json();

      if (result.ok) {
        setIsDirty(false);
      }

      if (!result.ok || result.released === false) {
        showToast(`락 해제 실패: ${result.message || 'unknown'}`, 'error');
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('release lock failed:', err);
      showToast('release-lock 호출 중 오류가 발생했습니다.', 'error');
    }
  };

  const downloadDocx = async () => {
    if (readOnly) {
      showToast('현재 읽기 전용 상태입니다. 다른 사용자가 수정 중입니다.', 'error');
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
      showToast('DOCX 다운로드가 시작되었습니다.', 'success');
    } catch (err) {
      showToast('DOCX 생성 실패', 'error');
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
      showToast('현재 읽기 전용 상태입니다. 다른 사용자가 수정 중입니다.', 'error');
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
    setActiveSection('basic');
    setIsDirty(true);
    showToast('새 문서를 시작합니다. 저장 버튼으로 반영하세요.', 'info');
  };

  const markDirty = () => setIsDirty(true);

  const addOverviewRow = () => {
    setOverview((prev) => [...prev, '']);
    markDirty();
  };

  const updateOverviewRow = (index: number, value: string) => {
    setOverview((prev) => prev.map((item, i) => (i === index ? value : item)));
    markDirty();
  };

  const removeOverviewRow = (index: number) => {
    setOverview((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [''];
    });
    markDirty();
  };

  const addDetailRow = (setter: React.Dispatch<React.SetStateAction<DetailRow[]>>) => {
    setter((prev) => [...prev, { ref: '', category: 'Improvement', title: '', desc: '' }]);
  };

  const updateDetailRow = (
    setter: React.Dispatch<React.SetStateAction<DetailRow[]>>,
    index: number,
    field: keyof DetailRow,
    value: string
  ) => {
    setter((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
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

  const updateNoteRow = (index: number, field: keyof NoteRow, value: string) => {
    setNotes((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const removeNoteRow = (index: number) => {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const addHistoryRow = () => {
    setHistory((prev) => [...prev, { date: '', xea: '', xes: '', cim: '', summary: '' }]);
  };

  const updateHistoryRow = (index: number, field: keyof HistoryRow, value: string) => {
    setHistory((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const removeHistoryRow = (index: number) => {
    setHistory((prev) => prev.filter((_, i) => i !== index));
  };

  const { previewWidthPct, handleResize } = usePreviewPanelWidth();
  const { collapsed: previewCollapsed, toggleCollapsed, expandPreview } = usePreviewCollapsed();

  const handleSectionChange = useCallback(
    (section: SectionKey) => {
      setActiveSection(section);
      if (section === 'generate') {
        expandPreview();
      }
    },
    [expandPreview]
  );

  const previewData = useMemo<ReleaseNotePreviewData>(
    () => ({
      site: displaySite,
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
    }),
    [
      displaySite,
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
    ]
  );

  const editorWidthPct = 100 - previewWidthPct;

  return (
    <div className="flex min-h-screen flex-col bg-park-surface text-slate-800">
      <EditorHeader
        displaySite={displaySite}
        equipment={equipment}
        currentUser={currentUser}
        readOnly={readOnly}
        onNewDocument={handleNewDocument}
        onGoDashboard={releaseAndGoDashboard}
        onChangeUserName={handleChangeUserName}
        onSave={saveCurrent}
      />

      <LockStatusBanner message={lockMessage} readOnly={readOnly} />

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
        <EditorSidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
        <EditorMobileNav activeSection={activeSection} onSectionChange={handleSectionChange} />

        <PreviewLayout
          activeSection={activeSection}
          previewData={previewData}
          previewWidthPct={previewWidthPct}
          editorWidthPct={editorWidthPct}
          onResize={handleResize}
          mobileViewMode={mobileViewMode}
          onMobileViewModeChange={setMobileViewMode}
          previewCollapsed={previewCollapsed}
          onTogglePreviewCollapse={toggleCollapsed}
        >
          {activeSection === 'basic' && (
            <BasicInfoSection
              readOnly={readOnly}
              displaySite={displaySite}
              date={date}
              xeaBefore={xeaBefore}
              xeaAfter={xeaAfter}
              xesBefore={xesBefore}
              xesAfter={xesAfter}
              cimVer={cimVer}
              overview={overview}
              onDateChange={(value) => {
                setDate(value);
                markDirty();
              }}
              onXeaBeforeChange={(value) => {
                setXeaBefore(value);
                markDirty();
              }}
              onXeaAfterChange={(value) => {
                setXeaAfter(value);
                markDirty();
              }}
              onXesBeforeChange={(value) => {
                setXesBefore(value);
                markDirty();
              }}
              onXesAfterChange={(value) => {
                setXesAfter(value);
                markDirty();
              }}
              onCimVerChange={(value) => {
                setCimVer(value);
                markDirty();
              }}
              onOverviewChange={updateOverviewRow}
              onAddOverview={addOverviewRow}
              onRemoveOverview={removeOverviewRow}
              onSave={saveCurrent}
              onNext={() => handleSectionChange('xea')}
            />
          )}

          {activeSection === 'xea' && (
            <DetailTableSection
              title="🔬 XEA 상세"
              emptyMessage="아직 등록된 XEA 상세 항목이 없습니다."
              rows={xeaDetails}
              readOnly={readOnly}
              onAdd={() => addDetailRow(setXeaDetails)}
              onUpdate={(index, field, value) => updateDetailRow(setXeaDetails, index, field, value)}
              onRemove={(index) => removeDetailRow(setXeaDetails, index)}
              onSave={saveCurrent}
              onPrev={() => handleSectionChange('basic')}
              onNext={() => handleSectionChange('xes')}
            />
          )}

          {activeSection === 'xes' && (
            <DetailTableSection
              title="🔬 XES 상세"
              emptyMessage="아직 등록된 XES 상세 항목이 없습니다."
              rows={xesDetails}
              readOnly={readOnly}
              onAdd={() => addDetailRow(setXesDetails)}
              onUpdate={(index, field, value) => updateDetailRow(setXesDetails, index, field, value)}
              onRemove={(index) => removeDetailRow(setXesDetails, index)}
              onSave={saveCurrent}
              onPrev={() => handleSectionChange('xea')}
              onNext={() => handleSectionChange('test')}
            />
          )}

          {activeSection === 'test' && (
            <DetailTableSection
              title="🧪 Test Version"
              emptyMessage="아직 등록된 Test Version 항목이 없습니다."
              rows={testVersions}
              readOnly={readOnly}
              refPlaceholder="예: PMS #9999"
              titlePlaceholder="테스트 버전 제목"
              descPlaceholder="테스트 버전 설명"
              onAdd={() => addDetailRow(setTestVersions)}
              onUpdate={(index, field, value) => updateDetailRow(setTestVersions, index, field, value)}
              onRemove={(index) => removeDetailRow(setTestVersions, index)}
              onSave={saveCurrent}
              onPrev={() => handleSectionChange('xes')}
              onNext={() => handleSectionChange('notes')}
            />
          )}

          {activeSection === 'notes' && (
            <NotesSection
              notes={notes}
              readOnly={readOnly}
              onAdd={addNoteRow}
              onUpdate={updateNoteRow}
              onRemove={removeNoteRow}
              onSave={saveCurrent}
              onPrev={() => handleSectionChange('test')}
              onNext={() => handleSectionChange('history')}
            />
          )}

          {activeSection === 'history' && (
            <HistorySection
              history={history}
              readOnly={readOnly}
              onAdd={addHistoryRow}
              onUpdate={updateHistoryRow}
              onRemove={removeHistoryRow}
              onSave={saveCurrent}
              onPrev={() => handleSectionChange('notes')}
              onNext={() => handleSectionChange('generate')}
            />
          )}

          {activeSection === 'generate' && (
            <GenerateSection
              readOnly={readOnly}
              onSave={saveCurrent}
              onPrev={() => handleSectionChange('history')}
              onDownloadDocx={downloadDocx}
            />
          )}
        </PreviewLayout>
      </div>

      <DashboardToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
