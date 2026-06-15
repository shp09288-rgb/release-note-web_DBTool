type StatCardProps = {
  label: string;
  value: number;
  accentClass: string;
  onClick?: () => void;
  active?: boolean;
};

export function StatCard({ label, value, accentClass, onClick, active }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'rounded-xl border bg-white p-4 text-left shadow-sm transition',
        'border-park-border',
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : '',
        active ? 'ring-2 ring-park-blue ring-offset-2' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={`text-3xl font-extrabold leading-none ${accentClass}`}>{value}</div>
      <div className="mt-2 text-sm font-medium text-slate-500">{label}</div>
    </Tag>
  );
}
