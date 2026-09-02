import { describe, it, expect } from 'vitest';
import { extractPmsNumbers } from '@/lib/pms/extract';

describe('extractPmsNumbers', () => {
  it('#번호를 뽑는다', () => {
    expect(extractPmsNumbers('PMS #4199 수정 완료')).toEqual([4199]);
  });

  it('# 뒤 공백을 허용한다', () => {
    expect(extractPmsNumbers('# 4199')).toEqual([4199]);
  });

  it('여러 개를 순서대로 뽑고 중복은 한 번만 센다', () => {
    expect(extractPmsNumbers('#4199 그리고 #3887, 다시 #4199')).toEqual([4199, 3887]);
  });

  it('설비 이름의 #1 같은 짧은 번호는 무시한다', () => {
    expect(extractPmsNumbers('NX-TSH2225 #1 설비')).toEqual([]);
  });

  it('여섯 자리 이상은 PMS 번호가 아니다', () => {
    expect(extractPmsNumbers('#123456')).toEqual([]);
  });

  it('빈 입력에 빈 배열을 준다', () => {
    expect(extractPmsNumbers('')).toEqual([]);
  });
});
