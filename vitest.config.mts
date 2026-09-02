import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // 우리가 새로 쓰는 테스트만 집는다.
    // lib/note-save.test.ts 와 lib/release-note-bulk-parser.test.ts 는
    // node:test 로 작성된 기존 테스트라 vitest 가 스위트를 못 찾고 실패한다.
    // 둘 다 Task 18 에서 지우는 작성 도구 코드의 테스트다.
    include: [
      'lib/version.test.ts',
      'lib/parsers/**/*.test.ts',
      'lib/queries/**/*.test.ts',
      'lib/pms/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
});
