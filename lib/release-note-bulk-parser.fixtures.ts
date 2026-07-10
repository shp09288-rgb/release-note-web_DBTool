/** 실제 Outlook Release Note 원문 기반 통합 Fixture */
export const OUTLOOK_RELEASE_NOTE_FIXTURE = `PMS #3622 PLC Monitor & EMO Viewer 개선
연관 PMS
PMS #3798 PLC Monitor 구현 요청
PMS #3007 Recipe / Tip Char. Option 구분 적용

Power Saving Mode 관련
PMS #3546 Power Saving Mode 구현
PMS #4198 Power Saving Mode State 변경 안됨

Tip Width X/Y 구분 관련
PMS #3202, PMS #3526 Tip Char. Log 개선

Teaching Pendant 관련
PMS #1742 Recipe 저장 기능 구현
측정 결과 폴더\\Debug 내 Recipe 저장

Feature Align 개선 관련
PMS #4074 Indexer Load/Unload 시 Timeout 기능 적용
Alarm ID: 90053
Alarm Text: load/unload sequence failed. Indexer wait timeout

Detector Calibration 시퀀스 변경 관련
PMS #4045 Detector Cal. Seq 변경
ImageProcessJob, TipCharacterizeJob 에서 XY Detector cal. -> Tip Align 하도록 수정

PMS #4705, PMS #4711 Manual Tip Check 안됨 개선
TipPositioningJob 에서 XY Detector cal. -> Tip Align 하도록 수정

PMS #4552 CIM 통신 안정화 개선
Power Saving Mode 관련
PMS #3546 Power Saving Mode 구현

좌표계 관련
PMS #4100 좌표계 보정 개선

환경안전 관련
PMS #4200 환경안전 센서 연동`;

export const SIMPLE_BULK_FIXTURE = `PMS #4705, #4711 Manual Tip Check 동작 안함
TipCharaterizeJob 내 Null Point Exception 예외 처리 개선
PMS #4045 Detector Cal 시퀀스 변경
TIp Positioning 시 XY Detector Calibration 후 Tip Align 진행하도록 Sequence 개선
PMS #4716 Enable Grip On 시 Password 입력 후 조작 화면 진입
PM Mode 해제 시 Wait time값을 DB에서 조회하여 적용하도록 수정
Dual Grip 사용 시 Enable Grip 신호 활성화 후 Password 입력해야 UI close 되도록 수정`;
