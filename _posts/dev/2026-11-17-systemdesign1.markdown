---
layout: content-layout
title: "시스템 설계 고수되기 1편 — 시스템 설계 진행 과정 🗺️"
date: 2026-11-17
categories: [TECH, 개발]
tags: [시스템설계, System Design, 요구사항분석, 아키텍처, API설계, 데이터베이스설계, UI설계, 백엔드]
---

## 안녕하십니까! 😀

면접에서 "URL 단축기를 설계해 보세요"를 들었을 때, 또는 실무에서 "이번 스프린트에 예약 기능을 붙여 주세요"를 들었을 때, 막히는 지점은 기술이 아니라 **어디서부터 그릴지**인 경우가 많습니다.

오늘은 **시스템 설계 고수되기** 시리즈의 첫 글입니다. 주제는 도구 목록이 아니라 **설계를 어떤 순서로 진행하는지**입니다.

이 글에서 다룰 단계는 다음과 같습니다.

1. 요구 사항 분석 (기능적 · 비기능적)
2. 상위 수준의 아키텍처 설계
3. 하위 수준의 상세 설계
4. 사용자 인터페이스 설계
5. API 설계
6. 데이터베이스 설계

설명만 나열하면 금방 흩어지므로, 글 전체에서 **스터디룸 예약 시스템** 하나를 예로 붙입니다. 면접 연습용으로도, 실무 킥오프용으로도 같은 순서를 그대로 쓸 수 있습니다.

---

## 0. 설계는 왜 "과정"인가

좋은 설계는 처음부터 ERD나 클래스 다이어그램을 그리는 일이 아닙니다. 먼저 **무엇을 만들지**를 고정하고, **큰 상자를 나눈 뒤**, **상자 안과 경계(API·화면·저장소)** 를 채웁니다.

대략 이런 흐름입니다.

```
요구 사항
   ↓
상위 아키텍처 (서비스·저장소·큐·캐시 박스)
   ↓
하위 상세 설계 (컴포넌트·시퀀스·상태)
   ↓
UI · API · DB (경계를 계약으로 고정)
```

UI·API·DB는 서로 기대는 관계라 순서가 조금 섞여도 됩니다. 다만 **요구 사항과 상위 구조 없이** 테이블부터 잡으면, 나중에 "이 컬럼이 왜 있지?"가 반복됩니다.

---

## 1. 요구 사항 분석

요구 사항은 **기능적(Functional)** 과 **비기능적(Non-Functional)** 으로 나눕니다.

- **기능적**: 사용자가 무엇을 할 수 있는가
- **비기능적**: 얼마나 빠르고, 안전하고, 커져도 버티는가

모호한 문장("편하게 예약되게")을 그대로 두면 설계가 흔들립니다. **주어·행동·조건·결과**가 보이게 씁니다.

### 📌 기능적 요구 사항 예시 (스터디룸 예약)

| ID | 요구 사항 | 수용 기준(예시) |
|----|-----------|-----------------|
| F1 | 회원은 날짜·시간·인원으로 빈 방을 검색한다 | 검색 결과에 이미 예약된 슬롯은 나오지 않는다 |
| F2 | 회원은 빈 슬롯을 예약한다 | 동일 슬롯에 두 예약이 동시에 생기지 않는다 |
| F3 | 회원은 본인 예약을 취소한다 | 시작 2시간 전까지만 취소 가능 |
| F4 | 관리자는 방·요금·운영 시간을 등록한다 | 운영 시간 밖 슬롯은 검색에 노출되지 않는다 |
| F5 | 시스템은 예약 확정·취소 알림을 보낸다 | 확정 후 1분 이내 이메일 또는 앱 푸시 |

범위를 줄이는 것도 요구 사항입니다. 1편 MVP에서는 예를 들어 이렇게 잘라 둡니다.

- 결제·환불은 제외 (예약만)
- 단체 예약·반복 예약은 제외
- 방 사진 업로드는 제외

✏️ <span style="color: red;">범위를 명시하지 않으면, 상위 아키텍처가 "만능 플랫폼"으로 부풀어 오릅니다.</span>

### 📌 비기능적 요구 사항 예시

| 항목 | 예시 목표 | 설계에 미치는 영향 |
|------|-----------|-------------------|
| **성능** | 검색 p95 200ms 이내 | 캐시, 인덱스, 읽기 전용 복제 |
| **처리량** | 피크 시간 초당 예약 시도 500 | 락 전략, 큐, 커넥션 풀 |
| **가용성** | 월간 가용률 99.9% | 다중 AZ, 장애 시 읽기 유지 |
| **일관성** | 같은 슬롯 이중 예약 금지 | 트랜잭션, 유니크 제약, 낙관적/비관적 락 |
| **보안** | 본인 예약만 조회·취소 | 인증·인가, 감사 로그 |
| **확장성** | 지점 10곳 → 100곳 | 서비스 분리, 샤딩 여부 판단 |
| **운영성** | 장애 원인 30분 내 추적 | 메트릭·로그·트레이스 |

숫자를 넣기 어려우면 최소한 **우선순위**라도 정합니다.  
스터디룸 예약에서는 보통 **"이중 예약 방지(일관성)"** 가 **"검색을 조금 더 빠르게"** 보다 앞입니다.

### 💡 요구 사항을 굳히는 질문

- 사용자는 누구인가? (회원, 관리자, 배치)
- 하루·피크 트래픽은 어느 정도인가?
- 데이터가 틀리면 안 되는 규칙은 무엇인가?
- 당장 안 해도 되는 것은 무엇인가?

이 답이 다음 단계의 상자 개수와 기술 선택을 결정합니다.

---

## 2. 상위 수준의 아키텍처 설계

상위 설계는 **시스템 전반을 큰 상자와 화살표로** 그리는 단계입니다. 클래스 이름이나 SQL은 아직 쓰지 않습니다.

질문은 세 가지입니다.

1. 요청은 어디서 들어오는가?
2. 핵심 업무는 어떤 서비스가 맡는가?
3. 상태(데이터)는 어디에 남는가?

### 📌 스터디룸 예약 — 상위 구조 예시

```
[웹/앱] ──HTTPS──▶ [API Gateway / LB]
                         │
                         ▼
              ┌─────────────────────┐
              │   Reservation API   │
              │  (검색·예약·취소)    │
              └──────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   [PostgreSQL]      [Redis]        [알림 워커]
   예약·방·회원        슬롯 캐시       (메일/푸시)
                         │
                    [메시지 큐]
                    예약확정 이벤트
```

이 그림에서 읽을 수 있어야 하는 것:

- **동기 경로**: 검색·예약·취소는 API가 DB/캐시와 바로 대화
- **비동기 경로**: 알림은 예약 성공 후 큐로 넘김 (예약 API 응답을 메일 SMTP에 묶지 않음)
- **읽기 가속**: 인기 날짜의 빈 슬롯 조회는 Redis
- **진실의 원천**: 예약 확정 여부는 PostgreSQL

### 📌 상위 설계에서 고르는 것들

| 결정 | 예시 선택 | 이유 |
|------|-----------|------|
| 모놀리스 vs 분리 | 초기는 모놀리스 API + 알림 워커 | 팀·트래픽이 작으면 분산 비용이 더 큼 |
| 동기 vs 비동기 | 알림만 비동기 | 사용자 대기 시간과 실패 재시도 분리 |
| 캐시 위치 | 검색 결과 / 슬롯 occupancy | 읽기가 많고, 잠깐의 지연은 허용 가능 |
| 외부 의존 | 이메일 제공자 | 어댑터 뒤로 숨길 경계 |

✏️ <span style="color: red;">상위 설계의 산출물은 "기술 나열"이 아니라, 트래픽·데이터·실패가 흐르는 경로입니다.</span>

면접이라면 이 단계에서 **병목 후보**(예약 쓰기, 인기 슬롯)와 **단일 장애점**(DB)을 한 문장씩만 말해도 충분합니다.

---

## 3. 하위 수준의 상세 설계

하위 설계는 상자를 열고 **내부 구조와 동작**을 적는 단계입니다.

- 모듈/컴포넌트 책임
- 주요 유스케이스의 시퀀스
- 상태 전이
- 동시성·실패 처리

### 📌 컴포넌트 책임 예시

| 컴포넌트 | 책임 | 하지 않는 일 |
|----------|------|--------------|
| `SearchService` | 날짜·인원으로 가능 슬롯 조회 | 결제, 알림 발송 |
| `ReservationService` | 예약 생성·취소, 이중 예약 방지 | HTML 렌더링 |
| `RoomCatalog` | 방·운영시간·정원 | 예약 락 |
| `NotificationPublisher` | 확정/취소 이벤트 발행 | SMTP 직접 호출 |
| `NotificationWorker` | 큐 소비, 재시도 | 예약 상태 변경 |

### 📌 시퀀스 예시 — 예약 생성

```
클라이언트
   │  POST /reservations
   ▼
ReservationService
   │  1) 회원·방·슬롯 유효성 검사
   │  2) 슬롯 가용 여부 확인 (DB 트랜잭션)
   │  3) 예약 행 INSERT (유니크 제약으로 최종 방어)
   │  4) 캐시 무효화 또는 점유 반영
   │  5) ReservationConfirmed 이벤트 발행
   ▼
응답 201 + reservationId
   │
   └─(비동기)─▶ Worker가 알림 전송
```

### 📌 상태 전이 예시

```
REQUESTED ──확정──▶ CONFIRMED ──취소──▶ CANCELLED
    │
    └──시간초과/실패──▶ EXPIRED
```

규칙 예:

- `CONFIRMED` → `CANCELLED` 는 시작 2시간 전까지만
- `CANCELLED` / `EXPIRED` 에서는 다시 `CONFIRMED`로 가지 않음
- 같은 `(room_id, start_at)` 에 `CONFIRMED`는 최대 1건

### 📌 동시성 상세 예시

같은 슬롯에 두 요청이 동시에 들어오면:

1. **애플리케이션**: 짧은 트랜잭션 안에서 "빈 슬롯인지" 확인 후 insert
2. **데이터베이스**: `(room_id, start_at)` UNIQUE + 상태 조건으로 최종 방어
3. **선택**: Redis `SETNX`로 짧은 예약 의도 락 (TTL 수 초) — UX용, DB 제약을 대체하지 않음

하위 설계 문서에는 "Redis만으로 막는다"고 쓰지 않는 편이 안전합니다. **권위 있는 결정은 DB**에 두고, 캐시·락은 속도를 돕는 장치로 둡니다.

### 💡 상세 설계 체크리스트

- 정상 경로뿐 아니라 **중복 클릭, 네트워크 재시도, 워커 중복 소비**를 적었는가
- 타임아웃·재시도 시 **멱등키**(예: `Idempotency-Key`)가 있는가
- 캐시와 DB가 어긋날 때 **어느 쪽을 믿는가**가 명시돼 있는가

---

## 4. 사용자 인터페이스 설계

백엔드 중심 글에서도 UI를 건너뛰면 안 됩니다. 화면은 **API가 무엇을 주고받아야 하는지**를 드러내는 명세입니다.

여기서의 UI 설계는 픽셀 완벽 시안이 아니라 **화면 목록 · 정보 구조 · 핵심 흐름**입니다.

### 📌 화면 목록 예시

| 화면 | 목적 | 주요 정보 |
|------|------|-----------|
| 검색 | 빈 방 찾기 | 날짜, 시작·종료, 인원, 지점 |
| 검색 결과 | 후보 비교 | 방 이름, 정원, 요금, 가능 여부 |
| 예약 확인 | 실수 방지 | 선택 슬롯 요약, 취소 정책 |
| 내 예약 | 조회·취소 | 상태, 시간, 취소 버튼 활성 조건 |
| 관리자 방 관리 | 카탈로그 | 운영 시간, 정원, 활성 여부 |

### 📌 핵심 사용자 흐름 예시

```
날짜/인원 입력 → 결과에서 슬롯 선택 → 확인 → 완료
                                      ↘ 실패(이미 예약됨) → 결과로 돌아가 다시 선택
```

확인 화면에서 보여 줘야 하는 것:

- 방 이름, 날짜·시간, 인원
- "시작 2시간 전까지만 취소 가능" 문구
- 제출 버튼 (로딩·중복 제출 방지)

### 📌 UI가 API·DB에 남기는 흔적

| UI 결정 | 설계 영향 |
|---------|-----------|
| 달력에서 날짜만 고르고 시간은 그리드로 고름 | 검색 API가 `date` + 슬롯 리스트를 반환 |
| 취소 버튼을 2시간 전까지만 활성화 | API가 `cancellableUntil` 또는 `canCancel`을 내려줌 |
| "예약 완료" 토스트 후 내 예약으로 이동 | 생성 API가 `reservationId`를 즉시 반환 |

✏️ <span style="color: red;">화면에서 사용자가 결정하는 값(날짜, 인원, 슬롯)이 곧 API 입력과 테이블 키가 됩니다.</span>

와이어프레임은 손그림·Figma·텍스트 박스 어느 쪽이든 됩니다. 중요한 것은 **한 화면에 정보가 넘치지 않게**, **실패 상태를 미리 그리는 것**입니다.

---

## 5. API 설계

API는 클라이언트와 서버가 지키는 **계약**입니다. 상위 상자가 정해진 뒤, UI 흐름에 맞춰 리소스와 동사를 고릅니다.

### 📌 설계 원칙 (짧게)

- 명사는 리소스, 동사는 HTTP 메서드
- 성공·실패 응답 형태를 통일
- 생성·취소처럼 부작용 있는 호출은 **멱등**을 고려
- 목록은 필터·페이지네이션을 명시

### 📌 API 정의 예시

#### 슬롯 검색

```http
GET /api/v1/rooms/availability?date=2026-11-20&partySize=4&branchId=b-12
```

```json
{
  "date": "2026-11-20",
  "slots": [
    {
      "roomId": "r-101",
      "roomName": "포커스 A",
      "startAt": "2026-11-20T10:00:00+09:00",
      "endAt": "2026-11-20T12:00:00+09:00",
      "capacity": 6,
      "price": 20000,
      "available": true
    }
  ]
}
```

#### 예약 생성

```http
POST /api/v1/reservations
Idempotency-Key: 8f3c2a1e-...
Content-Type: application/json

{
  "roomId": "r-101",
  "startAt": "2026-11-20T10:00:00+09:00",
  "endAt": "2026-11-20T12:00:00+09:00",
  "partySize": 4
}
```

```json
{
  "reservationId": "rsv-9k2m",
  "status": "CONFIRMED",
  "cancellableUntil": "2026-11-20T08:00:00+09:00"
}
```

실패 예:

| HTTP | 코드 | 상황 |
|------|------|------|
| 409 | `SLOT_TAKEN` | 방금 다른 사용자가 예약 |
| 400 | `OUTSIDE_HOURS` | 운영 시간 밖 |
| 401 | `UNAUTHORIZED` | 로그인 필요 |
| 422 | `PARTY_TOO_LARGE` | 정원 초과 |

#### 예약 취소

```http
POST /api/v1/reservations/rsv-9k2m/cancel
```

`DELETE`를 써도 되지만, 취소에 **사유·정책 검증**이 있으면 의도적 행동인 `POST .../cancel`이 읽기 쉬운 경우가 많습니다.

#### 내 예약 목록

```http
GET /api/v1/me/reservations?status=CONFIRMED&page=1&size=20
```

### 📌 버전·인증·에러 포맷

```json
{
  "error": {
    "code": "SLOT_TAKEN",
    "message": "이미 예약된 시간입니다.",
    "traceId": "a1b2c3"
  }
}
```

- 인증: Bearer JWT 또는 세션 쿠키
- 인가: `me` 경로는 본인만, 관리자 API는 역할 검사
- `traceId`는 로그·지원 문의와 연결

API 명세는 OpenAPI(Swagger)로 남기면 UI·서버·테스트가 같은 계약을 봅니다.

---

## 6. 데이터베이스 설계

DB는 **오래 남는 진실**을 담습니다. UI·API에서 나온 명사(회원, 방, 예약, 슬롯)를 테이블로 옮기고, 비기능 요구(이중 예약 금지, 검색 속도)를 제약·인덱스로 고정합니다.

### 📌 주요 엔티티

| 엔티티 | 설명 |
|--------|------|
| `member` | 예약하는 사용자 |
| `branch` | 지점 |
| `room` | 스터디룸 (지점 소속) |
| `reservation` | 확정·취소된 예약 |

슬롯을 미리 모두 행으로 만들 수도 있고(`slot` 테이블), 예약 시점의 `start_at`/`end_at`만 저장할 수도 있습니다. MVP에서는 **예약 행 + 방 운영시간 규칙**으로 충분하고, 스케줄이 복잡해지면 슬롯 테이블을 도입합니다.

### 📌 스키마 예시 (PostgreSQL 느낌)

```sql
CREATE TABLE member (
  id            UUID PRIMARY KEY,
  email         VARCHAR(320) NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE branch (
  id            UUID PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  timezone      VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul'
);

CREATE TABLE room (
  id            UUID PRIMARY KEY,
  branch_id     UUID NOT NULL REFERENCES branch(id),
  name          VARCHAR(100) NOT NULL,
  capacity      INT NOT NULL CHECK (capacity > 0),
  hourly_price  INT NOT NULL CHECK (hourly_price >= 0),
  open_time     TIME NOT NULL,
  close_time    TIME NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE reservation (
  id            UUID PRIMARY KEY,
  room_id       UUID NOT NULL REFERENCES room(id),
  member_id     UUID NOT NULL REFERENCES member(id),
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  party_size    INT NOT NULL CHECK (party_size > 0),
  status        VARCHAR(20) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at  TIMESTAMPTZ,
  CONSTRAINT reservation_time_chk CHECK (end_at > start_at),
  CONSTRAINT reservation_status_chk
    CHECK (status IN ('CONFIRMED', 'CANCELLED', 'EXPIRED'))
);

-- 같은 방에 같은 시작 시각의 CONFIRMED는 하나뿐
CREATE UNIQUE INDEX uq_room_start_confirmed
  ON reservation (room_id, start_at)
  WHERE status = 'CONFIRMED';

CREATE INDEX idx_reservation_member_created
  ON reservation (member_id, created_at DESC);

CREATE INDEX idx_reservation_room_range
  ON reservation (room_id, start_at, end_at)
  WHERE status = 'CONFIRMED';
```

### 📌 설계 포인트

1. **부분 유니크 인덱스**  
   취소된 행까지 막으면 같은 슬롯을 다시 팔 수 없습니다. `WHERE status = 'CONFIRMED'` 조건이 이중 예약 방지와 재판매를 동시에 해결합니다.

2. **시간 겹침**  
   시작 시각이 항상 정각 2시간 단위라면 `(room_id, start_at)` 유니크면 충분합니다. 임의 길이 예약이면 겹침 배제 제약(예: `EXCLUDE` with `tsrange`)이나 애플리케이션 검증이 필요합니다.

3. **검색 쿼리**  
   특정 날짜의 확정 예약을 읽어 "빈 슬롯"을 계산합니다. 방이 많고 조회가 잦으면 날짜별 occupancy를 캐시합니다.

4. **감사·알림**  
   알림 실패와 예약 성공을 같은 트랜잭션에 묶지 않습니다. 필요하면 `outbox` 테이블에 이벤트를 남긴 뒤 워커가 보냅니다.

### 📌 API·UI와 맞추기

| API/UI 필드 | 컬럼 |
|-------------|------|
| `roomId` | `room.id` |
| `startAt` / `endAt` | `reservation.start_at` / `end_at` |
| `status` | `reservation.status` |
| `cancellableUntil` | `start_at - 2 hours` (저장 또는 계산) |

`cancellableUntil`을 매번 계산해도 되고, 확정 시 컬럼에 심어도 됩니다. 정책이 바뀌면 계산형이, 당시 정책을 고정하려면 저장형이 유리합니다.

---

## 7. 한 줄로 잇는 전체 흐름

스터디룸 예약 MVP를 처음부터 끝까지 이어 보면 이렇게 됩니다.

| 단계 | 이 예시에서의 산출물 |
|------|----------------------|
| 요구 사항 | 검색·예약·취소, 이중 예약 금지, 알림, 결제 제외 |
| 상위 아키텍처 | API + PostgreSQL + Redis + 큐 + 알림 워커 |
| 하위 상세 | 예약 시퀀스, 상태 전이, UNIQUE로 동시성 방어 |
| UI | 검색 → 확인 → 내 예약, 취소 가능 시각 표시 |
| API | availability / reservations / cancel, 멱등키, 에러 코드 |
| DB | member·room·reservation, 부분 유니크 인덱스 |

다음 기능을 추가할 때도 같은 순서를 반복합니다.  
결제를 넣는다면 요구 사항에 "결제 완료 전후 상태"를 추가하고, 상위 상자에 Payment를 붙이며, API에 confirm 콜백을, DB에 payment 테이블을 더합니다. **과정이 같으면 확장이 예측 가능**해집니다.

---

## 마무리

시스템 설계 고수는 프레임워크를 많이 아는 사람이 아니라, **모호한 요청을 요구 사항으로 쪼개고, 상자로 나누고, 경계(UI·API·DB)를 계약으로 고정하는** 사람입니다.

오늘 정리한 진행 과정입니다.

1. **요구 사항** — 기능과 비기능을 숫자·우선순위로
2. **상위 아키텍처** — 요청·데이터·실패가 흐르는 큰 그림
3. **하위 상세** — 시퀀스, 상태, 동시성
4. **UI** — 사용자가 결정하는 정보와 실패 화면
5. **API** — 클라이언트와 서버의 계약
6. **DB** — 오래 남는 진실과 제약

다음 편에서는 같은 틀로 **용량 산정·병목 찾기·캐시·큐를 언제 쓰는지**처럼, 설계를 "면접·실무에서 말로 설득하는 법"을 이어 가겠습니다. 🙌

감사합니다!
