'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type EditorHeaderProps = {
  displaySite: string;
  equipment: string;
  currentUser: string;
  readOnly: boolean;
  onNewDocument: () => void;
  onGoDashboard: () => void;
  onChangeUserName: () => void;
  onSave: () => void;
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
          // try next
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-white/20 sm:h-11 sm:w-11">
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-park-blue text-sm font-extrabold text-white sm:h-11 sm:w-11">
      PS
    </div>
  );
}

export function EditorHeader({
  displaySite,
  equipment,
  currentUser,
  readOnly,
  onNewDocument,
  onGoDashboard,
  onChangeUserName,
  onSave,
}: EditorHeaderProps) {
  return (
    <header className="bg-park-navy text-white shadow-md">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <ParkLogo />
            <div>
              <h1 className="text-base font-extrabold sm:text-lg">SW Release Note Generator</h1>
              <p className="text-xs text-blue-100 sm:text-sm">
                Park Systems Corporation | Field Application Engineering
              </p>
              <p className="mt-1 text-xs font-semibold text-blue-50 sm:text-sm">
                {displaySite} / {equipment}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onNewDocument} disabled={readOnly} className={btnActionClass}>
              새로 만들기
            </button>
            <button type="button" onClick={onSave} disabled={readOnly} className={btnSaveClass}>
              저장
            </button>
            <button type="button" onClick={onGoDashboard} className={btnDashClass}>
              대시보드
            </button>
            <button type="button" onClick={onChangeUserName} className={btnUserClass}>
              {currentUser || '-'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

const btnActionClass =
  'rounded-lg bg-park-orange px-3 py-2 text-xs font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';

const btnSaveClass =
  'rounded-lg bg-white px-3 py-2 text-xs font-bold text-park-navy transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';

const btnDashClass =
  'rounded-lg bg-park-blue px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 sm:text-sm';

const btnUserClass =
  'rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20 sm:text-sm';
