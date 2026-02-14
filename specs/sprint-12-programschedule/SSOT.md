# Sprint 12 — ProgramSchedule 도입 (SSOT)

## 0. 결정 사항
- Reservation은 Program이 아니라 **ProgramSchedule(회차)**에 귀속된다.
- 일정/정원/가용성의 SSOT는 ProgramSchedule이다.
- 기존 API는 최대한 하위 호환 유지, 내부 로직은 schedule 중심으로 전환한다.

---

## 1. Goal
- 회차(날짜/시간/정원)를 Program에서 분리
- Reservation 생성은 programScheduleId 기준으로 통일
- 정원 초과 예약 방지
- 일정 단위 가용성 명확화

---

## 2. Non-goals
- 반복 일정 엔진
- 다일 프로그램
- 가격 정책 변경
- UI 개편

---

## 3. Domain Model

### ProgramSchedule

- id (uuid)
- programId (FK)
- startAt (DateTime)
- endAt (DateTime?)
- capacity (Int)
- status (ACTIVE | CANCELLED)
- createdAt
- updatedAt

Constraints:
- UNIQUE(programId, startAt)
- INDEX(startAt)
- INDEX(programId)

---

### Reservation 변경

- programScheduleId (FK) 추가
- 신규 예약은 scheduleId 필수
- 기존 programId는 점진적 제거 대상

---

## 4. Invariants

- (programId, startAt) 조합은 유일
- 정원 체크는 schedule 단위
- 예약은 반드시 특정 회차에 속한다

---

## 5. Capacity 전략 (MVP)

- remainingCapacity 저장하지 않음
- Reservation 집계로 정원 계산
- 필요 시 Sprint 13에서 remainingCapacity + atomic updateMany 도입

---

## 6. Migration Plan

1. ProgramSchedule 테이블 생성
2. Reservation에 programScheduleId 컬럼 추가
3. 기존 Reservation:
   - programId + 기존 startAt 기반으로 schedule upsert
   - reservation.programScheduleId 채움

---

## 7. API 변경

- GET /programs/:id/schedules
- POST /reservations
  - programScheduleId 필수
  - 하위 호환: programId + startAt 입력 시 schedule upsert

---

## 8. Tests

1. 동일 programId + startAt → schedule 1개만 생성
2. scheduleId 기반 예약 생성
3. capacity 초과 방지
4. backward compatibility 경로 검증

---

## 9. Done Criteria

- Schedule 기반 예약 생성 동작
- 기존 데이터 백필 완료
- 테스트 통과
- 빌드 통과
