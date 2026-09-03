import Link from 'next/link';
import { UploadWizard } from '@/components/upload/upload-wizard';

export default function UploadPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← 설비 목록
      </Link>
      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-extrabold text-park-navy">배포 문서 업로드</h1>
        <p className="mt-1 text-sm text-slate-500">
          파싱 결과를 확인하고 고친 뒤 저장합니다. 저장 전까지 DB에 쓰지 않습니다.
        </p>
      </header>
      <UploadWizard />
    </main>
  );
}
