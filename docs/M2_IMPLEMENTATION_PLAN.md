# M2 Graph Core 구현 계획

> 작성일: 2026-08-18
> 상태: 완료

## 목표

M1에서 React package 안에 구현한 runtime registry를 framework-independent core로
이동하고, UI가 신뢰할 수 있는 atomic graph update와 lifecycle 계약을 확정한다.

## 기존 동작 보호

구현 전 기준선은 다음 6개 테스트다.

- graph node/edge type guard 2개
- 조건부 Jotai dependency 갱신
- StrictMode consumer 등록과 unmount 정리
- provider-less/custom Store 격리와 JSON snapshot
- 특수 값 preview

M2 중 이 테스트를 삭제하거나 assertion을 약화하지 않는다. 타입 이동으로 import만
바뀌는 것은 허용한다.

## 변경 순서

### 1. GraphStore 추출

- node/edge map과 cached snapshot을 `packages/core`로 이동한다.
- `applyPatch`는 patch 전체를 먼저 검증하고 유효할 때만 atomic하게 적용한다.
- 같은 patch를 다시 적용하면 변경 이벤트를 발생시키지 않는다.
- node 제거 시 연결된 edge를 함께 제거한다.

### 2. Runtime validation

- 빈 ID/label, 중복 operation, add/remove 충돌을 거부한다.
- 존재하지 않는 endpoint를 참조하는 edge를 거부한다.
- invalid patch는 부분 적용하지 않고 구조화된 issue를 반환한다.
- cycle과 self edge는 유효한 graph로 허용한다.

### 3. Runtime identity와 lifecycle 이동

- Store와 atom object ID는 core의 WeakMap registry가 관리한다.
- consumer edge ref-count와 component orphan cleanup을 core로 이동한다.
- `releaseStore`가 해당 Store의 atom, dependency, consumer edge를 제거한다.
- 다른 Store에서도 소비되는 component node는 유지한다.

### 4. Traversal과 value policy

- upstream/downstream traversal은 visited set으로 cycle-safe하게 구현한다.
- value preview는 기본 비활성화한다.
- 명시적으로 활성화했을 때 길이 제한과 redaction callback을 적용한다.
- serializer 실패, circular object, Promise, Error, BigInt를 안전하게 처리한다.

### 5. React adapter 축소

- React package에는 Context, hook, Jotai adapter만 남긴다.
- graph storage, patch, identity, preview 구현은 core에서만 제공한다.
- 기존 public import가 깨지지 않도록 React package에서 core API를 재-export한다.

## 검증 기준

- 기존 6개 테스트 통과
- invalid patch atomic rejection test
- idempotent patch와 subscription notification test
- node cascade removal test
- Store release와 shared component lifecycle test
- cycle traversal test
- preview opt-in/redaction/truncation test
- clean frozen install, lint, typecheck, test, build, production audit 통과

## 의도적으로 하지 않는 작업

- React Flow UI와 layout
- build-time component metadata 주입
- async atom과 atomFamily 호환성 확장
- package publish export 확정
- Jotai private adapter 교체

이 항목들은 각각 M3, M4, M5, M6 또는 ADR 0001 재검토 범위다.
