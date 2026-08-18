# Jotai Visualizer 프로젝트 로드맵

> 상태: Active — M0 완료, M1 대기
> 기준일: 2026-08-18
> 문서 역할: 구현 범위, 아키텍처, 단계별 완료 조건에 대한 단일 기준 문서

## 1. 비전

Jotai Visualizer는 Jotai 애플리케이션의 런타임 상태 구조를 그래프로 보여주는
개발 도구다. atom의 값만 나열하는 도구를 넘어 다음 관계를 한 화면에서
탐색할 수 있어야 한다.

```text
primitive atom ──▶ derived atom ──▶ React component
       │                                  ▲
       └──────────────────────────────────┘
```

개발자는 이 그래프를 통해 상태의 생성, 의존성, 소비, 변경 전파를 추적하고
불필요한 결합이나 예상하지 못한 Store 공유를 발견할 수 있어야 한다.

## 2. 해결하려는 문제

Jotai의 공개 Store API는 `get`, `set`, `sub`를 중심으로 제공된다. 이 API만으로는
전체 atom을 열거하거나 subscriber가 어느 React 컴포넌트인지 식별하기 어렵다.
Jotai 내부에는 atom dependency, dependent, mount 상태가 있지만 내부 API이므로
버전 변경 가능성이 있다.

따라서 이 프로젝트는 두 계측 경로를 결합한다.

1. **Atom 계측:** Jotai Store의 런타임 정보에서 atom과 atom 의존성을 수집한다.
2. **Component 계측:** 빌드 플러그인이 Jotai hook 호출에 컴포넌트 metadata를
   주입하고, React runtime이 소비 관계를 등록한다.

참고 자료:

- [Jotai Store 구현](https://github.com/pmndrs/jotai/blob/main/src/vanilla/store.ts)
- [Jotai 내부 상태 구현](https://github.com/pmndrs/jotai/blob/main/src/vanilla/internals.ts)
- [Jotai DevTools](https://github.com/jotaijs/jotai-devtools)
- [Jotai DevTools snapshot 구현](https://github.com/jotaijs/jotai-devtools/blob/main/src/utils/useAtomsSnapshot.ts)
- [Vite Plugin API](https://vite.dev/guide/api-plugin)
- [React Flow 성능 가이드](https://reactflow.dev/learn/advanced-use/performance)

## 3. 제품 원칙

1. **Development only:** production 동작과 번들에 영향을 주지 않아야 한다.
2. **Committed render only:** 폐기된 React render의 관계를 그래프에 남기지 않는다.
3. **Store isolation:** 모든 atom 상태와 edge는 Store 단위로 분리한다.
4. **Runtime truth:** 조건부 derived atom처럼 실행 중 바뀌는 관계는 정적 분석보다
   실제 런타임 관계를 우선한다.
5. **Version isolation:** Jotai 내부 API 사용은 adapter 경계 안으로 제한한다.
6. **Incremental updates:** 전체 그래프를 매번 다시 만들지 않고 patch로 갱신한다.
7. **Privacy by default:** 전체 값 저장과 전송을 기본 동작으로 삼지 않는다.

## 4. MVP 범위

### 포함

- primitive/derived atom node 표시
- atom dependency edge 표시
- React component node 표시
- `useAtomValue`, `useSetAtom`, `useAtom` 소비 관계 표시
- read/write/read-write 관계 구분
- custom Store 및 provider-less Store 지원
- atom 이름 검색과 Store 필터
- 선택한 node의 upstream/downstream 강조
- atom 값의 안전한 preview
- 변경된 atom의 일시적 강조
- private atom 표시 토글
- Vite + React example application

### 제외

- Chrome/Firefox 확장
- 상태 수정 및 time travel
- React Native/Expo 지원
- 모든 bundler에 대한 자동 계측
- 컴포넌트 인스턴스별 graph
- 프로덕션 원격 모니터링
- 완전한 값 직렬화 및 영구 snapshot 보관

제외 항목은 core/runtime 안정화 후 별도 milestone에서 평가한다.

## 5. 시스템 아키텍처

```text
┌─────────────────────────────────────────────────────────────┐
│ User application                                            │
│                                                             │
│  Vite/Babel transform ── metadata ──▶ React instrumentation │
│                                           │                 │
│  Jotai Store ───────── atom state ──▶ Runtime Collector     │
└───────────────────────────────────────────┬─────────────────┘
                                            │ GraphPatch
                                            ▼
                                  ┌───────────────────┐
                                  │ Graph Core        │
                                  │ registry + model  │
                                  └─────────┬─────────┘
                                            │ snapshot
                                            ▼
                                  ┌───────────────────┐
                                  │ Visualizer UI     │
                                  │ graph + inspector │
                                  └───────────────────┘
```

### 권장 패키지 구조

```text
packages/
├── core/              # graph model, registry, GraphPatch
├── jotai-adapter/     # atom 상태와 dependency 수집
├── react/             # tracked hooks, Collector, DevTools component
├── babel-plugin/      # Jotai hook transform
├── vite/              # Babel transform을 감싸는 Vite plugin
└── ui/                # graph view와 inspector
examples/
├── vite-react/
├── multi-store/
├── async-atoms/
└── atom-family/
tests/
└── integration/
```

초기 spike에서는 패키지를 모두 분리하지 않아도 된다. 단, graph model과 Jotai
내부 adapter 경계는 첫 구현부터 분리한다.

## 6. 그래프 도메인 모델

```ts
type SourceLocation = {
  file: string
  line?: number
  column?: number
}

type AtomNode = {
  type: 'atom'
  id: string
  storeId: string
  label: string
  valuePreview?: string
  source?: SourceLocation
}

type ComponentNode = {
  type: 'component'
  id: string
  name: string
  source?: SourceLocation
}

type AtomDependencyEdge = {
  type: 'atom-dependency'
  source: string
  target: string
}

type ComponentConsumerEdge = {
  type: 'component-consumer'
  source: string
  target: string
  access: 'read' | 'write' | 'read-write'
}
```

edge는 데이터 흐름 방향으로 구성한다.

```text
dependency atom ──▶ derived atom
atom ──▶ consuming component
```

### 식별자 정책

- Store: Store 객체를 key로 사용하는 `WeakMap<Store, StoreId>`
- 정적 atom: source file + binding name + Store ID
- 동적 atom: runtime WeakMap ID + 가능한 경우 생성자/atomFamily metadata
- component: source file + component binding/export name
- MVP에서는 component instance가 아닌 component type 단위로 통합

`debugLabel`은 표시 이름으로 사용하되 유일한 ID로 사용하지 않는다.

## 7. 계측 설계

### 7.1 Atom 관계

MVP에서는 기존 `jotai-devtools`의 snapshot 기능을 재사용하는 방안을 우선
검증한다. 이를 통해 mounted atom, 값, dependent 관계와 async atom 처리를
직접 재구현하는 비용을 줄인다.

검증 결과 bundle 크기, API 결합, 버전 호환 문제가 크면 다음 인터페이스 뒤에
버전별 adapter를 구현한다.

```ts
interface JotaiInspectorAdapter {
  subscribe(listener: (patch: AtomGraphPatch) => void): () => void
  getSnapshot(): AtomGraphSnapshot
  dispose(): void
}
```

Jotai 내부 API import는 이 adapter 외부에서 금지한다.

### 7.2 Component 관계

빌드 플러그인은 다음 hook 호출을 tracked hook으로 변환한다.

| 원본 hook | access |
| --- | --- |
| `useAtomValue` | `read` |
| `useSetAtom` | `write` |
| `useAtom` | `read-write` |

개념적인 변환 결과:

```tsx
const [count, setCount] = useTrackedAtom(countAtom, undefined, {
  componentId: 'src/Counter.tsx#Counter',
  componentName: 'Counter',
  file: 'src/Counter.tsx',
  line: 2,
})
```

tracked hook은 render 도중 registry를 변경하지 않는다. `useEffect`가 commit된 뒤
관계를 등록하고 cleanup 시 해제한다. 동일 component type의 여러 instance를
지원하기 위해 다음 key에 reference count를 둔다.

```text
(storeId, atomId, componentId, access) → reference count
```

React DevTools의 비공개 global hook을 직접 읽는 방식은 MVP에서 사용하지 않는다.
React 버전 의존성이 높고 hook state에서 atom identity를 안정적으로 복원하기
어렵기 때문이다.

## 8. UI 설계

초기 graph renderer로 `@xyflow/react`를 검토한다. MVP UI는 다음 기능에 집중한다.

- atom과 component를 서로 다른 node 형태와 색상으로 표시
- dependency와 consumer edge의 선 모양 구분
- read/write/read-write badge
- 검색, Store 필터, private atom 토글
- node 선택 시 source, value preview, upstream/downstream 표시
- atom 변경 시 짧은 highlight
- pan, zoom, fit view, minimap

자동 layout은 graph 구조가 바뀔 때마다 실행하지 않는다. 첫 로드 또는 사용자의
명시적인 재배치 요청 때만 수행하고, drag로 변경한 위치를 유지한다. MVP layout은
Dagre를 우선 검토하고 compound graph가 필요할 때 ELK로 확장한다.

## 9. Milestone

### M0 — 저장소 기반 확립

**목표:** 구현과 검증을 반복할 수 있는 최소 개발 환경을 만든다.

**상태:** 완료 (2026-08-18)

산출물:

- [x] Git 저장소와 오픈소스 라이선스 확정
- [x] pnpm workspace와 TypeScript 설정
- [x] lint, typecheck, unit test 명령
- [x] CI에서 lint, typecheck, test 실행
- [x] 최소 Vite + React + Jotai example
- [x] contribution guide와 issue template

완료 조건:

- [x] fresh clone에서 한 번의 install로 개발 환경이 재현된다.
- [x] CI가 문서화된 모든 검증 명령을 실행한다.

검증 기록:

- `pnpm install --frozen-lockfile`
- `pnpm check`
- Vite 개발 서버의 example HTML 응답 확인

### M1 — Runtime feasibility spike

**목표:** atom graph와 component consumer graph를 실제 런타임에서 수집할 수
있는지 최소 코드로 증명한다.

산출물:

- [ ] primitive atom과 derived atom dependency 수집
- [ ] 수동 `useTrackedAtom*` hook 구현
- [ ] component read/write 관계 수집
- [ ] console 또는 JSON graph snapshot 출력
- [ ] provider-less/custom Store 각각의 example
- [ ] `jotai-devtools` 재사용 여부에 대한 ADR 작성

완료 조건:

- [ ] 조건부 derived dependency가 바뀌면 graph도 바뀐다.
- [ ] component unmount 후 소비 edge가 제거된다.
- [ ] custom Store의 graph가 서로 섞이지 않는다.
- [ ] 기술적으로 불가능하거나 private API가 필요한 경계가 문서화된다.

### M2 — Graph Core

**목표:** UI나 특정 Jotai 버전에 종속되지 않는 graph registry를 완성한다.

산출물:

- [ ] node/edge schema와 runtime validation 정책
- [ ] Store/atom/component ID registry
- [ ] ref-count 기반 consumer edge lifecycle
- [ ] incremental `GraphPatch` API
- [ ] graph snapshot과 subscription API
- [ ] 값 preview와 redaction 정책

완료 조건:

- [ ] 같은 patch를 반복 적용해도 중복 node/edge가 생기지 않는다.
- [ ] Store가 해제되면 관련 graph 데이터도 제거된다.
- [ ] 원형 graph를 무한 순회하지 않는다.
- [ ] core unit test가 lifecycle과 edge 변경을 보호한다.

### M3 — Embedded Visualizer MVP

**목표:** 수동 tracked hook을 사용하는 앱에서 유용한 graph UI를 제공한다.

산출물:

- [ ] floating panel과 열기/닫기 UI
- [ ] atom/component custom node
- [ ] dependency/consumer edge
- [ ] 검색, Store 필터, private atom 토글
- [ ] node detail inspector
- [ ] upstream/downstream highlight
- [ ] atom 변경 highlight
- [ ] layout과 사용자 node 위치 유지

완료 조건:

- [ ] 100 node graph에서 탐색과 drag가 원활하다.
- [ ] panel을 닫았을 때 불필요한 UI render가 발생하지 않는다.
- [ ] keyboard navigation과 기본 접근성 검사를 통과한다.
- [ ] application CSS와 Visualizer CSS가 충돌하지 않는다.

### M4 — Automatic instrumentation

**목표:** 사용자가 Jotai hook을 바꾸지 않아도 component 관계를 수집한다.

산출물:

- [ ] Babel transform fixture와 source map
- [ ] aliased import 처리
- [ ] `useAtom`, `useAtomValue`, `useSetAtom` 변환
- [ ] component/source metadata 주입
- [ ] Vite plugin과 virtual module
- [ ] HMR cleanup
- [ ] unsupported pattern diagnostic

완료 조건:

- [ ] 원본 hook의 runtime 결과와 TypeScript type이 유지된다.
- [ ] hook 순서가 변경되지 않는다.
- [ ] React StrictMode에서 edge가 중복되거나 누락되지 않는다.
- [ ] HMR 이후 stale component/atom node가 남지 않는다.
- [ ] production build에서 계측 코드가 제거된다.

### M5 — Compatibility and performance

**목표:** 실제 Jotai 사용 패턴과 큰 graph에서 안정적으로 동작한다.

산출물:

- [ ] async/Suspense atom example과 test
- [ ] `atomFamily` 및 동적 atom test
- [ ] 조건부 dependency test
- [ ] nested Provider와 multiple Store test
- [ ] error/Promise/Map/Set 값 preview test
- [ ] 500+ node benchmark fixture
- [ ] memory lifecycle test
- [ ] 지원 Jotai/React/Vite 버전 matrix

완료 조건:

- [ ] 500 node 기준 interaction 성능 목표를 수립하고 충족한다.
- [ ] unmount/HMR 반복 후 registry가 지속적으로 증가하지 않는다.
- [ ] 지원 버전 조합의 integration test가 CI를 통과한다.
- [ ] 알려진 호환성 제한이 사용자 문서에 공개된다.

### M6 — First open-source release

**목표:** 외부 사용자가 설치하고 문제를 재현하며 기여할 수 있는 첫 버전을
배포한다.

산출물:

- [ ] 설치 및 사용 문서
- [ ] example과 demo
- [ ] package별 public API 검토
- [ ] changeset 또는 release workflow
- [ ] security/privacy 문서
- [ ] `0.1.0` release

완료 조건:

- [ ] 문서의 설치 예제를 새 프로젝트에서 재현한다.
- [ ] package가 production tree-shaking 검증을 통과한다.
- [ ] 공개 API와 내부 API가 명확히 구분된다.
- [ ] 최소 한 개의 실제 애플리케이션에서 dogfooding한다.

## 10. 후속 후보

MVP 이후 사용자 요구와 유지보수 비용을 평가해 우선순위를 정한다.

- Chrome/Firefox DevTools extension transport
- graph snapshot 비교
- 변경 timeline
- 상태 수정과 time travel
- source file 열기
- component instance 보기
- Next.js/Babel/Webpack 통합
- React Native/Expo transport
- graph export/import

## 11. 테스트 전략

### Unit

- graph patch 적용과 중복 제거
- ref-count lifecycle
- Store 격리
- ID 생성과 metadata fallback
- 안전한 value preview와 redaction
- cycle-safe traversal

### Transform fixture

- named/default/aliased import
- TypeScript와 TSX
- hook별 access mode
- anonymous/default component
- nested function과 custom hook
- unsupported dynamic call
- source map 보존

### Integration

- React StrictMode
- mount/unmount/remount
- HMR
- provider-less/custom/multiple Store
- derived/conditional/async atom
- atomFamily
- production build tree-shaking

### Performance

- 100/500/1,000 node snapshot 처리 시간
- patch 처리량
- graph pan/zoom/drag frame 성능
- 반복 mount/unmount 후 registry와 heap 변화

## 12. 주요 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| Jotai 내부 API 변경 | atom graph 수집 실패 | adapter 격리, compatibility matrix, version pinning |
| compile transform 오탐 | 앱 동작 또는 hook 순서 변경 | 좁은 변환 범위, fixtures, unsupported diagnostic |
| StrictMode/Concurrent render | ghost edge 또는 중복 edge | effect 기반 등록, ref-count, integration test |
| HMR identity 변경 | stale node 축적 | source-based stable ID와 module dispose cleanup |
| 큰 graph 렌더링 | UI 지연 | incremental patch, memoization, collapse/filter, 제한적 layout |
| 상태 값 노출 | 개인정보/비밀 유출 | preview opt-in, redaction, 외부 전송 금지 |
| 기존 devtools와 충돌 | Store override 또는 중복 계측 | 단일 adapter ownership, 조합 테스트, 명확한 호환성 문서 |

## 13. 의사결정이 필요한 항목

다음 항목은 해당 milestone 시작 전에 ADR로 확정한다.

1. 라이선스: MIT 우선 검토
2. `jotai-devtools`를 runtime dependency로 재사용할지 여부
3. graph UI에 `@xyflow/react`를 채택할지 여부
4. layout engine으로 Dagre를 채택할지 여부
5. Babel transform을 독립 구현할지 기존 Jotai Babel plugin을 확장할지 여부
6. 지원할 Jotai/React/Vite 최소 버전
7. value preview의 기본 활성화 여부와 redaction API

## 14. 진행 규칙

- 작업은 현재 milestone의 완료 조건을 먼저 만족시킨다.
- scope가 바뀌면 구현보다 먼저 이 문서를 갱신한다.
- Jotai 또는 React private API를 도입할 때는 ADR과 호환성 test를 추가한다.
- 새로운 dependency는 역할, bundle 영향, 대안을 기록한 뒤 도입한다.
- milestone 완료 시 체크박스, 검증 결과, 알려진 제한을 함께 갱신한다.
- 완료되지 않은 항목은 다음 milestone로 암묵적으로 넘기지 않는다.

## 15. 다음 실행 항목

현재 다음 작업은 **M1 — Runtime feasibility spike**다.

1. `jotai-devtools` snapshot 재사용 가능성을 코드로 검증한다.
2. primitive/derived atom 관계를 JSON graph snapshot으로 변환한다.
3. 수동 `useTrackedAtom*` hook으로 component 소비 관계를 수집한다.
4. provider-less/custom Store 격리 example과 test를 추가한다.
5. 재사용 또는 독립 adapter 결정 사항을 ADR로 기록한다.

M1 완료 전에는 브라우저 확장, time travel, 다중 bundler 지원을 시작하지 않는다.
