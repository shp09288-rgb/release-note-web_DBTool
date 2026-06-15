type LockStatusBannerProps = {
  message: string;
  readOnly: boolean;
};

export function LockStatusBanner({ message, readOnly }: LockStatusBannerProps) {
  return (
    <div
      role="alert"
      className={[
        'border-b px-4 py-3 text-sm font-bold sm:px-6',
        readOnly
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-blue-200 bg-blue-50 text-blue-900',
      ].join(' ')}
    >
      {message || '락 상태 확인 중...'}
    </div>
  );
}
