# M1 Runtime Feasibility Spike

M1은 Jotai atom dependency와 React component consumer 관계를 하나의 JSON graph로
결합할 수 있음을 검증한다. 이 API는 자동 계측 전의 실험적 API다.

## 구성 요소

| API | 역할 |
| --- | --- |
| `createRuntimeGraph` | Store별 atom/component node와 edge 보관 |
| `RuntimeGraphProvider` | tracked hook에 runtime graph 제공 |
| `JotaiGraphCollector` | mounted atom, 값, dependency 수집 |
| `useTrackedAtomValue` | component의 read 관계 등록 |
| `useTrackedSetAtom` | component의 write 관계 등록 |
| `useTrackedAtom` | component의 read-write 관계 등록 |
| `GraphSnapshotLogger` | graph snapshot을 JSON으로 console 출력 |

## Provider-less Store

```tsx
import {
  GraphSnapshotLogger,
  JotaiGraphCollector,
  RuntimeGraphProvider,
  createRuntimeGraph,
  useTrackedAtomValue,
} from '@jotai-visualizer/react'

const runtime = createRuntimeGraph({
  valuePreview: {
    enabled: true,
    redact: (_value, { atomLabel }) =>
      /password|secret|token/i.test(atomLabel),
  },
})

function CounterLabel() {
  const count = useTrackedAtomValue(countAtom, {
    id: 'src/CounterLabel.tsx#CounterLabel',
    name: 'CounterLabel',
    file: 'src/CounterLabel.tsx',
  })
  return <span>{count}</span>
}

function Root() {
  return (
    <RuntimeGraphProvider runtime={runtime}>
      <JotaiGraphCollector />
      <GraphSnapshotLogger />
      <CounterLabel />
    </RuntimeGraphProvider>
  )
}
```

## Custom Store

collector와 tracked hook이 같은 Store를 사용해야 한다. Provider 내부 hook은 해당
Provider의 Store를 자동으로 사용한다.

```tsx
const customStore = createStore()

<RuntimeGraphProvider runtime={runtime}>
  <Provider store={customStore}>
    <JotaiGraphCollector store={customStore} />
    <CounterLabel />
  </Provider>
</RuntimeGraphProvider>
```

Provider 밖에서는 tracked hook의 세 번째 인자로 Store를 지정할 수 있다.

```tsx
useTrackedAtomValue(countAtom, componentMetadata, { store: customStore })
```

## JSON snapshot

React 밖에서는 runtime에서 직접 읽을 수 있다.

```ts
const snapshot = runtime.getSnapshot()
const json = runtime.getJsonSnapshot()
```

축약된 예시:

```json
{
  "nodes": [
    {
      "kind": "atom",
      "id": "store:1/atom:1",
      "storeId": "store:1",
      "label": "countAtom",
      "valuePreview": "1"
    },
    {
      "kind": "component",
      "id": "component:src/Counter.tsx#Counter",
      "label": "Counter"
    }
  ],
  "edges": [
    {
      "kind": "component-consumer",
      "source": "store:1/atom:1",
      "target": "component:src/Counter.tsx#Counter",
      "access": "read-write"
    }
  ]
}
```

## 확인된 동작

- 조건부 derived atom이 읽는 atom을 바꾸면 이전 dependency edge가 제거된다.
- component unmount 시 consumer edge와 사용되지 않는 component node가 제거된다.
- StrictMode effect 재실행에서 consumer edge가 중복되지 않는다.
- 같은 atom 객체를 default/custom Store에서 사용해도 서로 다른 atom node가 된다.
- 값 preview는 circular object, BigInt, Promise, Error에서 예외를 던지지 않는다.

## 알려진 제한

- runtime package는 Store보다 먼저 import되어야 한다.
- component metadata는 현재 수동으로 제공한다.
- component instance가 아니라 metadata ID 단위로 합쳐진다.
- 값 preview는 opt-in 디버깅용 축약 표현이며 완전한 serializer가 아니다.
- 한 Store에는 하나의 `JotaiGraphCollector`만 두는 것을 전제로 한다.
- `jotai-devtools`의 private Jotai API 결합을 상속한다.
- async atom과 atomFamily 정확도는 M5 범위다.

세부 결정과 대안은
[ADR 0001](adr/0001-jotai-devtools-runtime-adapter.md)을 참고한다.
