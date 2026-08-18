# ADR 0001: M1 atom inspector에 jotai-devtools utility를 제한적으로 재사용한다

- 상태: Accepted for 0.1 with Jotai `>=2.20 <3`
- 결정일: 2026-08-18
- 범위: `@jotai-visualizer/react`의 atom snapshot 수집

## 배경

Jotai의 공개 Store API는 `get`, `set`, `sub`만 노출한다. 이 API만으로는 전체
mounted atom을 열거하거나 derived atom의 런타임 dependency를 조회할 수 없다.
Jotai 내부에는 atom state의 dependency map과 mounted dependent set이 있지만
private API이므로 버전 호환 책임이 생긴다.

M1의 목적은 완전한 inspector를 설계하는 것이 아니라 다음 가능성을 실제 코드와
테스트로 검증하는 것이다.

- 조건부 derived dependency를 런타임에서 관찰할 수 있는가?
- atom snapshot을 component consumer graph와 결합할 수 있는가?
- default/custom Store를 격리할 수 있는가?

## 결정

M1에서는 `jotai-devtools@0.14.0`의 `jotai-devtools/utils` subpath가 제공하는
`useAtomsSnapshot`을 사용한다.

의존성은 다음 파일 하나로 격리한다.

```text
packages/react/src/jotai-devtools-adapter.tsx
```

다른 runtime, graph, UI 코드는 `jotai-devtools`나 `jotai/vanilla/internals`를 직접
import하지 않는다. 외부에는 `JotaiGraphCollector`만 노출한다.

이 결정은 M1 spike를 위한 제한적 승인이다. M2 시작 시 package 크기, Store 생성
순서, 지원 Jotai 버전을 다시 평가하고 독립 `JotaiInspectorAdapter`로 교체할 수
있어야 한다.

## 검증 결과

이 접근으로 다음 동작을 테스트에서 확인했다.

- primitive/derived atom node 수집
- dependency atom에서 derived atom으로 향하는 edge 생성
- 조건 변경 후 사용하지 않는 dependency edge 제거
- provider-less default Store와 custom Store의 분리
- component 소비 edge와 atom dependency edge의 결합

## 비용과 제한

### Private API 결합

`jotai-devtools`는 내부적으로 다음 API에 의존한다.

- `INTERNAL_overrideCreateStore`
- `INTERNAL_buildStoreRev3`
- `INTERNAL_initializeStoreHooksRev3`
- Jotai atom state와 mounted map

따라서 현재 adapter의 실질적인 최소 Jotai 버전은 `2.20.0`이며 Jotai 내부 변경에
따라 동작하지 않을 수 있다.

### Store 생성 순서

`jotai-devtools/utils` import가 `createStore` override를 등록한다. 해당 import보다
먼저 생성된 Store는 dev methods가 없으므로 snapshot을 제공하지 못할 수 있다.
애플리케이션 entry에서 runtime package를 정적으로 import하는 현재 example은 이
조건을 만족하지만, 지연 import되는 devtool에는 제약이 된다.

### 설치 의존성

utility subpath만 bundle에 포함하면 example JavaScript 증가는 gzip 기준 약 3KB로
작았지만, npm package는 UI와 Redux DevTools 의존성도 함께 설치한다. M1 설치에서
약 95개 package가 추가되었다.

사용하지 않는 하위 package 때문에 다음 peer 예외도 필요했다.

- `@redux-devtools/extension`의 누락된 Redux peer
- `react-json-tree`의 React 19 미표기

전역 strict peer 검사는 유지하고 이 두 예외만 `pnpm-workspace.yaml`에 한정했다.

또한 `jotai-devtools`가 허용하는 `jsondiffpatch` 구버전에서 XSS advisory가
발견되어 해당 하위 의존성을 패치된 `0.7.6`으로 override했다. Utility-only 경로는
HTML formatter를 사용하지 않지만 lockfile 자체가 취약 버전을 포함하지 않도록
`pnpm audit --prod`를 검증 절차에 포함한다.

### Component identity 미지원

Jotai snapshot은 subscriber listener가 어느 React 컴포넌트에 속하는지 알려주지
않는다. Component 관계는 별도의 manual tracked hook으로 수집해야 한다.

## 검토한 대안

### Jotai private API 직접 사용

설치 크기와 Store 생성 순서를 더 잘 제어할 수 있지만 M1에서 Jotai 내부 구현을
복제하고 유지하는 비용이 크므로 보류했다.

### 정적 분석만 사용

조건부 dependency, async atom, atomFamily가 실행 중 만드는 관계를 정확하게
표현할 수 없어 기각했다.

### `store.sub` wrapping만 사용

전체 mounted atom과 atom dependency, component identity를 복원할 수 없어
기각했다.

## M2 재검토 조건

M2에서는 다음 중 하나를 명시적으로 선택한다.

1. `jotai-devtools` utility를 계속 사용하고 지원 버전을 고정한다.
2. 최소 기능의 versioned Jotai adapter를 직접 유지한다.
3. Jotai/Jotai DevTools upstream에 headless inspector package 분리를 제안한다.

선택 전 다음을 측정한다.

- cold install package 수와 크기
- utility-only production bundle 크기
- import 이전에 생성된 Store 지원 가능성
- Jotai minor/major 버전 compatibility test
- async atom과 atomFamily 정확도

## M2 재검토 결과

M2에서 graph storage, identity, lifecycle, traversal, value policy를 모두
`@jotai-visualizer/core`로 이동했다. `jotai-devtools` import는 계속
`packages/react/src/jotai-devtools-adapter.tsx` 한 파일에만 남아 있어 adapter를
교체해도 core와 UI 계약에는 영향을 주지 않는다.

따라서 M3 UI 구현 전 별도 private adapter를 만드는 비용은 지불하지 않고 현재
utility를 유지한다. 설치 의존성과 Store 생성 순서 문제는 해결된 것이 아니므로
공개 호환성 범위를 확정하는 M5에서 async atom, atomFamily, Jotai version matrix와
함께 다시 평가한다.

## M5 재검토 결과

Jotai 2.20.0과 2.20.2에서 conditional dependency, mounted async atom, atomFamily,
nested Provider, multiple Store integration이 통과했다. Core/UI가 adapter와 분리되어
있고 M6 직전 별도 headless inspector를 재구현하는 비용이 더 크므로 0.1에서는
현재 adapter를 유지한다.

대신 peer range를 Jotai `>=2.20.0 <3.0.0`으로 제한한다. Jotai 3 지원은 private
store API 변경을 확인하고 versioned adapter 또는 upstream headless inspector를
검토한 뒤 별도 결정한다.
