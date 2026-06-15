'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardActions } from '@/components/dashboard/dashboard-actions';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardLoadingGrid } from '@/components/dashboard/dashboard-loading-grid';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { DashboardToast, type ToastState } from '@/components/dashboard/dashboard-toast';
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar';
import { EquipmentCard } from '@/components/dashboard/equipment-card';
import { NoteModal } from '@/components/dashboard/note-modal';
import type { Item, SortKey, StatusFilter } from '@/components/dashboard/types';
import { matchesStatusFilter } from '@/components/dashboard/types';

const USER_NAME_STORAGE_KEY = 'rn_user_name';

function normalizeUserName(value: string | null | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed || 'User01';
}

function getOrCreateUserName() {
  const existing = window.localStorage.getItem(USER_NAME_STORAGE_KEY);
  if (existing && existing.trim()) return existing.trim();

  const input = window.prompt('대시보드에서 사용할 이름을 입력하세요.', 'User01');
  const finalName = normalizeUserName(input);
  window.localStorage.setItem(USER_NAME_STORAGE_KEY, finalName);
  return finalName;
}

export default function DashboardPage() {
  const router = useRouter();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [editSite, setEditSite] = useState('');
  const [editEquipment, setEditEquipment] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSite, setNewSite] = useState('');
  const [newEquipment, setNewEquipment] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      const res = await fetch('/api/list-notes', { cache: 'no-store' });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error('Failed to load dashboard items:', err);
      setItems([]);
      showToast('대시보드 데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function verifyPassword(password: string) {
    const res = await fetch('/api/dashboard-password/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const result = await res.json();
    return !!result.verified;
  }

  async function requestDashboardPassword(actionLabel: string) {
    const password = window.prompt(`${actionLabel}하려면 비밀번호를 입력하세요.`, '');
    if (password === null) return null;

    const verified = await verifyPassword(password);
    if (!verified) {
      showToast('비밀번호가 올바르지 않습니다.', 'error');
      return null;
    }

    return password;
  }

  function handleChangeUserName() {
    const input = window.prompt('저장/편집 이력에 표시할 사용자 이름을 입력하세요.', currentUser || 'User01');
    if (input === null) return;

    const nextUser = normalizeUserName(input);
    window.localStorage.setItem(USER_NAME_STORAGE_KEY, nextUser);
    setCurrentUser(nextUser);
    showToast(`사용자 이름이 '${nextUser}'(으)로 변경되었습니다.`, 'success');
  }

  async function handleChangePassword() {
    const currentPassword = window.prompt('현재 비밀번호를 입력하세요.', '');
    if (currentPassword === null) return;

    const newPassword = window.prompt('새 비밀번호를 입력하세요.', '');
    if (newPassword === null) return;

    const confirmPassword = window.prompt('새 비밀번호를 다시 입력하세요.', '');
    if (confirmPassword === null) return;

    if (!newPassword.trim()) {
      showToast('새 비밀번호를 비워둘 수 없습니다.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('새 비밀번호가 서로 일치하지 않습니다.', 'error');
      return;
    }

    const res = await fetch('/api/dashboard-password/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = await res.json();

    if (!result.ok) {
      showToast(result.message || '비밀번호 변경 실패', 'error');
      return;
    }

    showToast('비밀번호가 변경되었습니다.', 'success');
  }

  const handleEditClick = async (item: Item) => {
    const password = await requestDashboardPassword('카드를 수정');
    if (!password) return;

    setEditTarget(item);
    setEditSite(item.site);
    setEditEquipment(item.equipment);
    setShowEditModal(true);
  };

  const handleDeleteClick = async (item: Item) => {
    const ok = window.confirm(`정말 삭제하시겠습니까?\n${item.site} / ${item.equipment}`);
    if (!ok) return;

    const password = await requestDashboardPassword('카드를 삭제');
    if (!password) return;

    try {
      const res = await fetch('/api/delete-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: item.noteId,
          site: item.site,
          equipment: item.equipment,
          fileName: item.file,
          password,
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        showToast(result.message || '삭제 실패', 'error');
        return;
      }

      showToast('삭제 완료', 'success');
      await loadItems();
    } catch (err) {
      console.error(err);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;

    const password = await requestDashboardPassword('카드 수정을 저장');
    if (!password) return;

    try {
      const res = await fetch('/api/rename-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: editTarget.noteId,
          oldSite: editTarget.site,
          oldEquipment: editTarget.equipment,
          oldFileName: editTarget.file,
          newSite: editSite,
          newEquipment: editEquipment,
          password,
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        showToast(result.message || '수정 실패', 'error');
        return;
      }

      showToast('수정 완료', 'success');
      setShowEditModal(false);
      setEditTarget(null);
      setEditSite('');
      setEditEquipment('');
      await loadItems();
    } catch (err) {
      console.error(err);
      showToast('수정 중 오류가 발생했습니다.', 'error');
    }
  };

  async function handleCreateNote() {
    const site = newSite.trim();
    const equipment = newEquipment.trim();

    if (!site || !equipment) {
      showToast('Site와 Equipment를 모두 입력하세요.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/create-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, equipment }),
      });

      const result = await res.json();

      if (!result.ok) {
        showToast(result.message || '새 카드 생성 실패', 'error');
        return;
      }

      setShowCreateModal(false);
      setNewSite('');
      setNewEquipment('');
      await loadItems();
      showToast(result.message || '새 카드가 생성되었습니다.', 'success');
    } catch (err) {
      console.error(err);
      showToast('새 카드 생성 중 오류가 발생했습니다.', 'error');
    }
  }

  useEffect(() => {
    const userTimer = window.setTimeout(() => {
      setCurrentUser(getOrCreateUserName());
    }, 0);

    const loadTimer = window.setTimeout(() => {
      loadItems();
    }, 0);

    const timer = window.setInterval(() => {
      loadItems();
    }, 100000);

    return () => {
      window.clearTimeout(userTimer);
      window.clearTimeout(loadTimer);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      next = next.filter((item) => matchesStatusFilter(item, statusFilter));
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
      editable: items.filter((item) => matchesStatusFilter(item, 'editable')).length,
      locked: items.filter(
        (item) => matchesStatusFilter(item, 'locked') || matchesStatusFilter(item, 'stale_lock')
      ).length,
      noData: items.filter((item) => matchesStatusFilter(item, 'no_data')).length,
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-park-surface">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <DashboardHeader
          currentUser={currentUser}
          onChangeUserName={handleChangeUserName}
          onChangePassword={handleChangePassword}
        />

        <DashboardToolbar
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
        />

        <DashboardStats
          total={stats.total}
          editable={stats.editable}
          locked={stats.locked}
          noData={stats.noData}
          statusFilter={statusFilter}
          onFilterSelect={setStatusFilter}
        />

        <DashboardActions
          onCreate={() => setShowCreateModal(true)}
          onRefresh={loadItems}
          refreshing={loading}
        />

        {loading ? (
          <DashboardLoadingGrid />
        ) : filteredItems.length === 0 ? (
          <DashboardEmptyState hasQuery={!!query.trim() || statusFilter !== 'all'} query={query} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <EquipmentCard
                key={item.noteId || item.file}
                item={item}
                onOpen={() => router.push(`/editor/${item.site}/${item.equipment}`)}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        )}
      </div>

      <NoteModal
        open={showCreateModal}
        title="새 카드 추가"
        description="Site와 Equipment를 입력하면 새 Release Note 카드가 생성됩니다."
        site={newSite}
        equipment={newEquipment}
        onSiteChange={setNewSite}
        onEquipmentChange={setNewEquipment}
        onClose={() => {
          setShowCreateModal(false);
          setNewSite('');
          setNewEquipment('');
        }}
        onSubmit={handleCreateNote}
        submitLabel="생성"
      />

      <NoteModal
        open={showEditModal}
        title="카드 정보 수정"
        description="선택한 카드의 Site와 Equipment를 수정합니다."
        site={editSite}
        equipment={editEquipment}
        onSiteChange={setEditSite}
        onEquipmentChange={setEditEquipment}
        onClose={() => {
          setShowEditModal(false);
          setEditTarget(null);
          setEditSite('');
          setEditEquipment('');
        }}
        onSubmit={handleSaveEdit}
        submitLabel="저장"
      />

      <DashboardToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
