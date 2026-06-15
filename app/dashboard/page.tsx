'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ChangePasswordModal } from '@/components/ui/change-password-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { PasswordModal } from '@/components/ui/password-modal';
import { TextInputModal } from '@/components/ui/text-input-modal';

const USER_NAME_STORAGE_KEY = 'rn_user_name';

function normalizeUserName(value: string | null | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed || 'User01';
}

type UserNameModalState =
  | { open: false }
  | { open: true; mode: 'initial' | 'change'; defaultValue: string };

type PasswordRequestState = {
  actionLabel: string;
};

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

  const [userNameModal, setUserNameModal] = useState<UserNameModalState>({ open: false });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [passwordModal, setPasswordModal] = useState<PasswordRequestState | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const passwordResolveRef = useRef<((password: string | null) => void) | null>(null);

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

  const closePasswordModal = useCallback((password: string | null) => {
    passwordResolveRef.current?.(password);
    passwordResolveRef.current = null;
    setPasswordModal(null);
    setPasswordSubmitting(false);
  }, []);

  const requestDashboardPassword = useCallback((actionLabel: string) => {
    return new Promise<string | null>((resolve) => {
      passwordResolveRef.current = resolve;
      setPasswordModal({ actionLabel });
    });
  }, []);

  const handlePasswordModalSubmit = useCallback(
    async (password: string) => {
      if (!passwordModal) return;

      setPasswordSubmitting(true);
      const verified = await verifyPassword(password);
      setPasswordSubmitting(false);

      if (!verified) {
        showToast('비밀번호가 올바르지 않습니다.', 'error');
        return;
      }

      closePasswordModal(password);
    },
    [closePasswordModal, passwordModal, showToast]
  );

  const handlePasswordModalCancel = useCallback(() => {
    closePasswordModal(null);
  }, [closePasswordModal]);

  const handleUserNameModalSubmit = useCallback(
    (value: string) => {
      const mode = userNameModal.open ? userNameModal.mode : 'initial';
      const nextUser = normalizeUserName(value);
      window.localStorage.setItem(USER_NAME_STORAGE_KEY, nextUser);
      setCurrentUser(nextUser);
      setUserNameModal({ open: false });

      if (mode === 'change') {
        showToast(`사용자 이름이 '${nextUser}'(으)로 변경되었습니다.`, 'success');
      }
    },
    [showToast, userNameModal]
  );

  const handleUserNameModalCancel = useCallback(() => {
    if (userNameModal.open && userNameModal.mode === 'initial') {
      const fallback = normalizeUserName('User01');
      window.localStorage.setItem(USER_NAME_STORAGE_KEY, fallback);
      setCurrentUser(fallback);
    }
    setUserNameModal({ open: false });
  }, [userNameModal]);

  function handleChangeUserName() {
    setUserNameModal({
      open: true,
      mode: 'change',
      defaultValue: currentUser || 'User01',
    });
  }

  async function handleChangePasswordSubmit(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    const { currentPassword, newPassword, confirmPassword } = payload;

    if (!newPassword.trim()) {
      showToast('새 비밀번호를 비워둘 수 없습니다.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('새 비밀번호가 서로 일치하지 않습니다.', 'error');
      return;
    }

    setChangePasswordSubmitting(true);

    try {
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
      setShowChangePasswordModal(false);
    } catch (err) {
      console.error(err);
      showToast('비밀번호 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setChangePasswordSubmitting(false);
    }
  }

  const handleEditClick = async (item: Item) => {
    const password = await requestDashboardPassword('카드를 수정');
    if (!password) return;

    setEditTarget(item);
    setEditSite(item.site);
    setEditEquipment(item.equipment);
    setShowEditModal(true);
  };

  const handleDeleteClick = (item: Item) => {
    setDeleteTarget(item);
  };

  const handleDeleteConfirmed = async () => {
    const item = deleteTarget;
    if (!item) return;

    setDeleteTarget(null);

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
    const initTimer = window.setTimeout(() => {
      const existing = window.localStorage.getItem(USER_NAME_STORAGE_KEY);
      if (existing && existing.trim()) {
        setCurrentUser(existing.trim());
      } else {
        setUserNameModal({ open: true, mode: 'initial', defaultValue: 'User01' });
      }
    }, 0);

    const loadTimer = window.setTimeout(() => {
      loadItems();
    }, 0);

    const timer = window.setInterval(() => {
      loadItems();
    }, 100000);

    return () => {
      window.clearTimeout(initTimer);
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
          onChangePassword={() => setShowChangePasswordModal(true)}
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

      <TextInputModal
        open={userNameModal.open}
        title={
          userNameModal.open && userNameModal.mode === 'initial'
            ? '사용자 이름 설정'
            : '사용자 이름 변경'
        }
        description={
          userNameModal.open && userNameModal.mode === 'initial'
            ? '대시보드에서 사용할 이름을 입력하세요.'
            : '저장/편집 이력에 표시할 사용자 이름을 입력하세요.'
        }
        label="사용자 이름"
        defaultValue={userNameModal.open ? userNameModal.defaultValue : 'User01'}
        placeholder="예: User01"
        submitLabel="확인"
        onSubmit={handleUserNameModalSubmit}
        onCancel={handleUserNameModalCancel}
      />

      <PasswordModal
        open={!!passwordModal}
        title="비밀번호 확인"
        description={passwordModal ? `${passwordModal.actionLabel}하려면 비밀번호를 입력하세요.` : ''}
        actionLabel={passwordModal?.actionLabel || ''}
        submitting={passwordSubmitting}
        onSubmit={handlePasswordModalSubmit}
        onCancel={handlePasswordModalCancel}
      />

      <ChangePasswordModal
        open={showChangePasswordModal}
        submitting={changePasswordSubmitting}
        onSubmit={handleChangePasswordSubmit}
        onCancel={() => {
          if (!changePasswordSubmitting) setShowChangePasswordModal(false);
        }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="카드 삭제"
        description="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        highlight={
          deleteTarget
            ? {
                label: '삭제 대상',
                value: `${deleteTarget.site} / ${deleteTarget.equipment}`,
              }
            : undefined
        }
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />

      <DashboardToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
