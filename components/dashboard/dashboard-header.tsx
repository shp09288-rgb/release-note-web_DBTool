'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type DashboardHeaderProps = {
  currentUser: string;
  onChangeUserName: () => void;
  onChangePassword: () => void;
};

function ParkLogo() {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    const candidates = ['/park-logo.png', '/park-mascot.png'];
    let cancelled = false;

    async function resolveLogo() {
      for (const src of candidates) {
        try {
          const res = await fetch(src, { method: 'HEAD' });
          if (res.ok) {
            if (!cancelled) setLogoSrc(src);
            return;
          }
        } catch {
          // try next candidate
        }
      }
    }

    resolveLogo();
    return () => {
      cancelled = true;
    };
  }, []);

  if (logoSrc) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-white/20">
        <Image
          src={logoSrc}
          alt="Park Systems"
          width={44}
          height={44}
          style={{ width: 'auto', height: 'auto' }}
          className="max-h-[44px] max-w-[44px] object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-park-blue text-sm font-extrabold text-white">
      PS
    </div>
  );
}

export function DashboardHeader({
  currentUser,
  onChangeUserName,
  onChangePassword,
}: DashboardHeaderProps) {
  return (
    <header className="rounded-2xl bg-park-navy px-4 py-4 text-white shadow-md sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <ParkLogo />
          <div>
            <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">설비 대시보드</h1>
            <p className="text-xs text-blue-100 sm:text-sm">
              Park Systems · Release Note Management
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-blue-50">
            현재 사용자: {currentUser || '-'}
          </div>
          <button
            type="button"
            onClick={onChangeUserName}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20"
          >
            이름 수정
          </button>
          <button
            type="button"
            onClick={onChangePassword}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20"
          >
            비밀번호 변경
          </button>
        </div>
      </div>
    </header>
  );
}
