import Link from 'next/link';

interface Props {
  site: string;
  equipment: string;
}

export default function DashboardCard({ site, equipment }: Props) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #d9e2ef',
        borderRadius: 12,
        padding: 16,
        width: 260,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18 }}>
        {site}
      </div>

      <div style={{ marginTop: 4, color: '#555' }}>
        {equipment}
      </div>

      <Link
        href={`/editor/${site}/${equipment}`}
        style={{
          marginTop: 12,
          display: 'inline-block',
          padding: '8px 12px',
          background: '#1B3A6B',
          color: '#fff',
          borderRadius: 6,
          textDecoration: 'none',
        }}
      >
        열기
      </Link>
    </div>
  );
}