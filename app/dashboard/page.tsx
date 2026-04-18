'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = {
  file: string;
  site: string;
  equipment: string;
  date: string;
  xeaAfter: string;
  xesAfter: string;
  cimVer: string;
  hasOverview: boolean;
  hasHistory: boolean;
  overviewCount: number;
  historyCount: number;
  updatedAt: string;
  status: 'editable' | 'no_data' | 'locked' | 'stale_lock';
  lockUser?: string;
  lockUpdatedAt?: string;
  lockStale?: boolean;
};

type SortKey = 'recent' | 'site' | 'equipment';

function getOrCreateUserName() {
  const key = 'rn_user_name';
  const existing = window.localStorage.getItem(key);
  if (existing && existing.trim()) return existing.trim();

  const input = window.prompt('대시보드에서 사용할 이름을 입력하세요.', 'User01');
  const finalName = (input || 'User01').trim() || 'User01';
  window.localStorage.setItem(key, finalName);
  return finalName;
}

export default function DashboardPage() {
  const router = useRouter();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editSite, setEditSite] = useState('');
  const [editEquipment, setEditEquipment] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'editable' | 'locked' | 'stale_lock' | 'no_data'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSite, setNewSite] = useState('');
  const [newEquipment, setNewEquipment] = useState('');

  async function loadItems() {
    try {
      setLoading(true);
      const res = await fetch('/api/list-notes', { cache: 'no-store' });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error('Failed to load dashboard items:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

const handleEditClick = (item: any) => {
  setEditTarget(item);
  setEditSite(item.site);
  setEditEquipment(item.equipment);
  setShowEditModal(true);
};

const handleDeleteClick = async (item: any) => {
  const ok = window.confirm(
    `정말 삭제하시겠습니까?\n${item.site} / ${item.equipment}`
  );
  if (!ok) return;

  try {
    const res = await fetch('/api/delete-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: item.file,
      }),
    });

    const result = await res.json();

    if (!result.ok) {
      alert(result.message || '삭제 실패');
      return;
    }

    alert('삭제 완료');
    await loadItems();
  } catch (err) {
    console.error(err);
    alert('에러 발생');
  }
};

const handleSaveEdit = async () => {
  if (!editTarget) return;

  try {
    const res = await fetch('/api/rename-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldFileName: editTarget.file,
        newSite: editSite,
        newEquipment: editEquipment,
      }),
    });

    const result = await res.json();

    if (!result.ok) {
      alert(result.message || '수정 실패');
      return;
    }

    alert('수정 완료');

    setShowEditModal(false);
    setEditTarget(null);
    setEditSite('');
    setEditEquipment('');
    await loadItems();
  } catch (err) {
    console.error(err);
    alert('에러 발생');
  }
};

  async function handleCreateNote() {
  const site = newSite.trim();
  const equipment = newEquipment.trim();

  if (!site || !equipment) {
    alert('Site와 Equipment를 모두 입력하세요.');
    return;
  }

  try {
    const res = await fetch('/api/create-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site,
        equipment,
      }),
    });

    const result = await res.json();

    if (!result.ok) {
      alert(result.message || '새 카드 생성 실패');
      return;
    }

    setShowCreateModal(false);
    setNewSite('');
    setNewEquipment('');
    await loadItems();

    alert(result.message || '새 카드가 생성되었습니다.');
  } catch (err) {
    console.error(err);
    alert('새 카드 생성 중 오류가 발생했습니다.');
  }
}

  async function handleCreateNote() {
  const site = newSite.trim();
  const equipment = newEquipment.trim();

  if (!site || !equipment) {
    alert('Site와 Equipment를 모두 입력하세요.');
    return;
  }

  try {
    const res = await fetch('/api/create-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site,
        equipment,
      }),
    });

    const result = await res.json();

    if (!result.ok) {
      alert(result.message || '새 카드 생성 실패');
      return;
    }

    setShowCreateModal(false);
    setNewSite('');
    setNewEquipment('');
    await loadItems();

    alert(result.message || '새 카드가 생성되었습니다.');
  } catch (err) {
    console.error(err);
    alert('새 카드 생성 중 오류가 발생했습니다.');
  }
}

  useEffect(() => {
    setCurrentUser(getOrCreateUserName());
    loadItems();

    const timer = window.setInterval(() => {
      loadItems();
    }, 100000); //100초마다 갱신
    
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let next = [...items];

    if (normalizedQuery) {
      next = next.filter((item) => {
        const searchText = [
          item.site,
          item.equipment,
          item.date,
          item.xeaAfter,
          item.xesAfter,
          item.cimVer,
          item.status,
          item.lockUser || '',
        ]
          .join(' ')
          .toLowerCase();

        return searchText.includes(normalizedQuery);
      });
    }

    if (statusFilter !== 'all') {
      next = next.filter((item) => item.status === statusFilter);
    }

    next.sort((a, b) => {
      if (sortKey === 'site') {
        return `${a.site}_${a.equipment}`.localeCompare(`${b.site}_${b.equipment}`);
      }

      if (sortKey === 'equipment') {
        return a.equipment.localeCompare(b.equipment);
      }

      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

    return next;
  }, [items, query, statusFilter, sortKey]);

  const stats = useMemo(() => {
  return {
    total: items.length,
    editable: items.filter((item) => item.status === 'editable').length,
    locked: items.filter(
      (item) => item.status === 'locked' || item.status === 'stale_lock'
    ).length,
    noData: items.filter((item) => item.status === 'no_data').length,
  };
}, [items]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f3f6fb',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#173b73',
            }}
          >
            설비 대시보드
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: '#fff',
              border: '1px solid #d6dee8',
              color: '#475569',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            현재 사용자: {currentUser || '-'}
          </div>          
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px 160px',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Site, Equipment, 수정자 검색 (예: A6, EQ01, user1)"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid #cfd8e3',
              background: '#fff',
              fontSize: 15,
              outline: 'none',
              color: '#334155',
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'editable' | 'locked' | 'stale_lock' | 'no_data'
              )
            }
            style={{
              padding: '14px 12px',
              borderRadius: 10,
              border: '1px solid #cfd8e3',
              background: '#fff',
              fontSize: 14,
              color: '#334155',
            }}
          >
            <option value="all">상태: 전체</option>
            <option value="editable">편집 가능</option>
            <option value="locked">수정 중</option>
            <option value="stale_lock">Stale Lock</option>
            <option value="no_data">데이터 없음</option>
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{
              padding: '14px 12px',
              borderRadius: 10,
              border: '1px solid #cfd8e3',
              background: '#fff',
              fontSize: 14,
              color: '#334155',
            }}
          >
            <option value="recent">정렬: 최근 수정순</option>
            <option value="site">정렬: Site순</option>
            <option value="equipment">정렬: Equipment순</option>
          </select>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatCard label="전체 설비" value={stats.total} color="#173b73" />
          <StatCard label="편집 가능" value={stats.editable} color="#1f9d55" />
          <StatCard label="잠금" value={stats.locked} color="#c2410c" />
          <StatCard label="데이터 없음" value={stats.noData} color="#64748b" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12 }}>
  
  <button
    type="button"
    onClick={() => setShowCreateModal(true)}
    style={{
      padding: '10px 16px',
      borderRadius: 10,
      border: 'none',
      background: '#ED7D31',
      color: '#fff',
      cursor: 'pointer',
      fontWeight: 700,
    }}
  >
    + 새 카드 추가
  </button>

  <button
    type="button"
    onClick={loadItems}
    style={{
      padding: '10px 16px',
      borderRadius: 10,
      border: '1px solid #cfd8e3',
      background: '#fff',
      color: '#334155',
      cursor: 'pointer',
      fontWeight: 700,
    }}
  >
    새로고침
  </button>

</div>

        {loading ? (
          <div
            style={{
              border: '1px solid #d6dee8',
              borderRadius: 14,
              background: '#fff',
              padding: 28,
              color: '#64748b',
              fontSize: 15,
            }}
          >
            대시보드 데이터를 불러오는 중입니다...
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            style={{
              border: '1px solid #d6dee8',
              borderRadius: 14,
              background: '#fff',
              padding: 28,
              color: '#64748b',
              fontSize: 15,
            }}
          >
            표시할 설비가 없습니다.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16,
              alignItems: 'stretch',
            }}
          >
            {filteredItems.map((item) => (
              <Card
  key={item.file}
  item={item}
  currentUser={currentUser}
  onClick={() => router.push(`/editor/${item.site}/${item.equipment}`)}
  onEdit={handleEditClick}
  onDelete={handleDeleteClick}
/>
            ))}
          </div>
        )}
      </div>
{showCreateModal ? (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 460,
        background: '#ffffff',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.18)',
        border: '1px solid #d6dee8',
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#173b73',
          marginBottom: 8,
        }}
      >
        새 카드 추가
      </div>

      <div
        style={{
          fontSize: 14,
          color: '#475569',
          marginBottom: 18,
          lineHeight: 1.6,
        }}
      >
        Site와 Equipment를 입력하면 새 Release Note 카드가 생성됩니다.
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
              marginBottom: 6,
            }}
          >
            Site
          </div>
          <input
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            placeholder="예: SDC_A6"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #cfd8e3',
              fontSize: 14,
              outline: 'none',
              color: '#0f172a',
              background: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
              marginBottom: 6,
            }}
          >
            Equipment
          </div>
          <input
            value={newEquipment}
            onChange={(e) => setNewEquipment(e.target.value)}
            placeholder="예: EQ01"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #cfd8e3',
              fontSize: 14,
              outline: 'none',
              color: '#0f172a',
              background: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 22,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setShowCreateModal(false);
            setNewSite('');
            setNewEquipment('');
          }}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #cfd8e3',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          취소
        </button>

        <button
          type="button"
          onClick={handleCreateNote}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#2f5ea7',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          생성
        </button>
      </div>
    </div>
  </div>
) : null}
{showEditModal ? (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 460,
        background: '#ffffff',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.18)',
        border: '1px solid #d6dee8',
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#173b73',
          marginBottom: 8,
        }}
      >
        카드 정보 수정
      </div>

      <div
        style={{
          fontSize: 14,
          color: '#475569',
          marginBottom: 18,
          lineHeight: 1.6,
        }}
      >
        선택한 카드의 Site와 Equipment를 수정합니다.
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
              marginBottom: 6,
            }}
          >
            Site
          </div>
          <input
            value={editSite}
            onChange={(e) => setEditSite(e.target.value)}
            placeholder="예: SDC_A6"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #cfd8e3',
              fontSize: 14,
              outline: 'none',
              color: '#0f172a',
              background: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
              marginBottom: 6,
            }}
          >
            Equipment
          </div>
          <input
            value={editEquipment}
            onChange={(e) => setEditEquipment(e.target.value)}
            placeholder="예: EQ01"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #cfd8e3',
              fontSize: 14,
              outline: 'none',
              color: '#0f172a',
              background: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 22,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setShowEditModal(false);
            setEditTarget(null);
            setEditSite('');
            setEditEquipment('');
          }}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #cfd8e3',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          취소
        </button>

        <button
          type="button"
          onClick={handleSaveEdit}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#2f5ea7',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          저장
        </button>
      </div>
    </div>
  </div>
) : null}
    </div>
  );

}

function Card({
  item,
  currentUser,
  onClick,
  onEdit,
  onDelete,
}: {
  item: Item;
  currentUser: string;
  onClick: () => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #d6dee8',
        borderRadius: 14,
        padding: 18,
        cursor: 'pointer',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.10)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(15, 23, 42, 0.06)';
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: '#173b73',
            }}
          >
            {item.site} / {item.equipment}
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#64748b',
              marginTop: 4,
            }}
          >
            {item.site} · {item.equipment}
          </div>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <div
  style={{
    fontSize: 14,
    color: '#475569',
    lineHeight: 1.8,
  }}
>
  <div>최신 수정 {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</div>
  <div>릴리즈 날짜 {item.date || '-'}</div>
  <div>XEA {item.xeaAfter || '-'}</div>
  <div>XES {item.xesAfter || '-'}</div>

  {item.status === 'locked' || item.status === 'stale_lock' ? (
    <>
      <div>수정 중 사용자 {item.lockUser || '-'}</div>
      <div>
        잠금 시각 {item.lockUpdatedAt ? new Date(item.lockUpdatedAt).toLocaleString() : '-'}
      </div>
    </>
  ) : null}

  <div>latest.json {item.status === 'no_data' ? '없음' : '있음'}</div>
</div>
      

<div
  style={{
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  }}
>
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onDelete(item);
    }}
    style={{
      padding: '10px 14px',
      borderRadius: 10,
      border: '1px solid #f3c2c2',
      background: '#fff5f5',
      color: '#b42318',
      fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    삭제
  </button>

  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onEdit(item);
    }}
    style={{
      padding: '10px 14px',
      borderRadius: 10,
      border: '1px solid #cfd8e3',
      background: '#fff',
      color: '#334155',
      fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    수정
  </button>

  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    style={{
      padding: '10px 18px',
      borderRadius: 10,
      border: 'none',
      background: '#2f5ea7',
      color: '#fff',
      fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    바로 열기
  </button>
</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; color: string; bg: string }> = {
    editable: {
      text: '● Editable',
      color: '#15803d',
      bg: '#e8f5ec',
    },
    locked: {
      text: '● 수정 중',
      color: '#b45309',
      bg: '#fff4e5',
    },
    stale_lock: {
      text: '● Stale Lock',
      color: '#b91c1c',
      bg: '#fee2e2',
    },
    no_data: {
      text: '● 데이터 없음',
      color: '#64748b',
      bg: '#eef2f7',
    },
  };

  const item = map[status] || map.no_data;

  return (
    <div
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: item.color,
        background: item.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {item.text}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = '#173b73',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        border: '1px solid #d6dee8',
        borderRadius: 12,
        padding: 18,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 14,
          color: '#64748b',
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
}