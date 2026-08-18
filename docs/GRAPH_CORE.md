# Graph Core

`@jotai-visualizer/core`는 React와 Jotai 버전에 의존하지 않는 graph 저장소와
runtime identity/lifecycle 계층이다.

## 계층

```text
Jotai adapter / tracked React hooks
                 │
                 ▼
RuntimeGraph ── identity, Store lifecycle, consumer ref-count
                 │
                 ▼
GraphStore ─── atomic patch, validation, snapshot, traversal
```

## GraphStore

```ts
import { createGraphStore } from '@jotai-visualizer/core'

const graph = createGraphStore()
const result = graph.applyPatch({
  upsertNodes: [
    { kind: 'atom', id: 'a', storeId: 'store:1', label: 'countAtom' },
    { kind: 'component', id: 'c', label: 'Counter' },
  ],
  upsertEdges: [
    {
      kind: 'component-consumer',
      id: 'a-to-c',
      source: 'a',
      target: 'c',
      access: 'read-write',
    },
  ],
})
```

### Patch 규칙

`applyPatch`는 다음 순서로 동작한다.

1. patch 전체와 적용 후 endpoint를 검증한다.
2. 하나라도 invalid하면 아무 operation도 적용하지 않는다.
3. edge 제거, node 제거와 연결 edge cascade, node upsert, edge upsert 순서로
   적용한다.
4. 실제 내용이 변경된 경우에만 subscriber에게 알린다.

같은 patch를 여러 번 적용할 수 있다. 두 번째 이후 결과는 다음과 같다.

```ts
{ applied: true, changed: false, issues: [] }
```

지원하는 validation issue:

- 빈 node/edge ID
- 빈 node label
- atom의 누락된 Store ID
- 한 patch 안의 중복 ID
- 동일 ID의 upsert/remove 충돌
- 기존 node/edge의 kind 변경
- 존재하지 않는 edge endpoint
- edge 종류와 맞지 않는 endpoint node 종류
- 올바르지 않은 component access mode

cycle과 self dependency는 실제 상태 graph에서 발생할 수 있으므로 거부하지 않는다.

### Snapshot과 subscription

```ts
const unsubscribe = graph.subscribe(() => {
  console.log(graph.getSnapshot())
})
```

snapshot과 내부 배열/node/edge는 freeze된다. 변경이 없는 동안
`getSnapshot()`은 동일한 객체를 반환한다.

### Cycle-safe traversal

```ts
graph.traverse('atom:a', {
  direction: 'downstream',
  edgeKinds: ['atom-dependency'],
})
```

반환 목록은 시작 node를 제외하며 visited set을 사용하므로 원형 graph에서도
종료한다.

## RuntimeGraph

`RuntimeGraph`는 Store와 atom object에 WeakMap 기반 ID를 부여하고 GraphStore에
patch를 전달한다.

```ts
const runtime = createRuntimeGraph()
const storeId = runtime.getStoreId(store)
const atomNodeId = runtime.getAtomNodeId(store, atom)
```

같은 object는 release 전까지 동일한 ID를 사용한다. 같은 atom object를 여러
Store에서 사용하면 `storeId/atomId` 조합으로 서로 다른 node가 된다.

Atom node에는 값 변경을 UI가 감지할 수 있는 `revision`과 Jotai 내부 atom 여부를
표시하는 `private` metadata가 포함될 수 있다. Revision은 value preview 활성화와
무관하게 `Object.is` 기준 값 변경 시 증가한다.

### Consumer lifecycle

`registerConsumer`는 같은 Store/atom/component/access 관계를 ref-count한다.

```ts
const unregister = runtime.registerConsumer({
  store,
  atom,
  component: { id: 'src/Counter.tsx#Counter', name: 'Counter' },
  access: 'read',
})

unregister()
```

마지막 consumer가 해제되면 edge가 제거된다. 다른 edge가 없는 component node도
함께 제거된다.

### Store lifecycle

collector unmount와 실제 Store 폐기는 구분한다.

- `clearAtomSnapshot(store)`: collector가 소유한 atom/dependency만 제거한다.
- `releaseStore(store)`: Store의 atom과 모든 연결 edge를 제거하고 Store ID를
  해제한다.

Jotai Store에는 dispose event가 없으므로 Store owner가 실제 폐기 시점에
`releaseStore`를 호출해야 한다.

## Value preview와 redaction

값 preview는 개인정보나 token 노출을 방지하기 위해 기본적으로 비활성화된다.

```ts
const runtime = createRuntimeGraph({
  valuePreview: {
    enabled: true,
    maxLength: 120,
    redact: (_value, { atomLabel }) =>
      /password|secret|token/i.test(atomLabel),
  },
})
```

redaction callback이 `true`를 반환하거나 예외를 던지면 `[Redacted]`를 저장한다.
표시 가능한 값도 `maxLength`로 잘라낸다. Promise, Error, BigInt, circular object는
예외 없이 축약한다.

preview는 원본 snapshot이 아니며 상태 복원이나 time travel에 사용하면 안 된다.

## 현재 경계

- Jotai atom 수집은 여전히 React package의 `JotaiGraphCollector`가 담당한다.
- Jotai private API 결합은 core가 아니라 adapter 한 파일에만 존재한다.
- Store 폐기 감지는 자동이 아니다.
- persistence, history, time travel은 제공하지 않는다.
- package publish용 export는 M6에서 확정한다.
