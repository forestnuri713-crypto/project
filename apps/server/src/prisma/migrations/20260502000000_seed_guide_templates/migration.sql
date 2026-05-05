-- Seed default guide templates (idempotent — skips if kind already exists)

INSERT INTO "guide_templates" ("id", "kind", "content", "created_at", "updated_at")
VALUES (
    '11111111-1111-4111-8111-000000000001',
    'SAFETY',
    E'- 긴 소매, 긴 바지 착용 권장 (벌레, 가시 등 대비)\n- 운동화 또는 등산화 착용\n- 개인 물병 지참\n- 우천 시 우비 또는 우산 지참\n- 알레르기(벌, 식물 등) 보유자는 사전 고지 필수',
    NOW(),
    NOW()
)
ON CONFLICT ("kind") DO NOTHING;

INSERT INTO "guide_templates" ("id", "kind", "content", "created_at", "updated_at")
VALUES (
    '11111111-1111-4111-8111-000000000002',
    'PAYMENT',
    E'- 예약 신청 후 OO시간 이내 결제 완료 시 예약 확정\n- 미결제 시 예약 자동 취소\n- 세금계산서 필요 시 고객센터로 별도 요청\n- 단체 예약 시 고객센터 문의',
    NOW(),
    NOW()
)
ON CONFLICT ("kind") DO NOTHING;

INSERT INTO "guide_templates" ("id", "kind", "content", "created_at", "updated_at")
VALUES (
    '11111111-1111-4111-8111-000000000003',
    'CANCEL',
    E'[환불 정책]\n- 체험일 7일 전: 100% 환불\n- 체험일 2일 전: 50% 환불\n- 체험 당일 / 노쇼: 환불 불가\n\n[처리 안내]\n- 취소 신청 후 영업일 기준 3~5일 이내 환불 처리\n- 카드 결제 취소의 경우 카드사 정책에 따라 반영 시점이 상이할 수 있습니다\n\n[불가피한 취소]\n- 기상 악화, 천재지변, 강사 부재 등 불가피한 사정으로 프로그램 취소 시 100% 환불\n- 대체 일정 우선 안내',
    NOW(),
    NOW()
)
ON CONFLICT ("kind") DO NOTHING;

INSERT INTO "guide_templates" ("id", "kind", "content", "created_at", "updated_at")
VALUES (
    '11111111-1111-4111-8111-000000000004',
    'INQUIRY',
    E'[전화]\n000-0000-0000\n운영시간: 평일 09:00 ~ 18:00 (주말·공휴일 휴무)\n\n[온라인 문의]\n- 이메일: oooo@oooo.com\n- 홈페이지 내 1:1 문의 게시판 이용\n\n[자주 묻는 질문(FAQ)]\n- 홈페이지 FAQ 페이지에서 주요 문의 사항 확인 가능',
    NOW(),
    NOW()
)
ON CONFLICT ("kind") DO NOTHING;
