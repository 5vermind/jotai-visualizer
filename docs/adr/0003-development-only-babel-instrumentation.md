# ADR 0003: Vite 개발 서버에서 Babel AST로 Jotai hook을 계측한다

- 상태: Accepted
- 결정일: 2026-08-18
- 범위: M4 Automatic Instrumentation

## 배경

Jotai Store는 subscriber의 React component identity를 제공하지 않는다. React
DevTools private hook이나 runtime stack trace로 component를 추론하는 방식은 React
버전과 minification에 취약하다. M3까지는 tracked hook에 metadata를 수동으로
전달했지만 실제 사용성을 위해 build-time 자동화가 필요하다.

## 결정

- AST engine은 Node 20과 호환되는 Babel 7을 사용한다.
- Vite plugin은 `enforce: 'pre'`, `apply: 'serve'`로 개발 서버에서만 동작한다.
- runtime import는 `virtual:jotai-visualizer/runtime` virtual module을 사용한다.
- `jotai`와 `jotai/react`의 named import를 지원한다.
- `useAtom`, `useAtomValue`, `useSetAtom`의 aliased import를 지원한다.
- named PascalCase function/arrow component 안의 direct call만 자동 변환한다.
- custom hook, anonymous callback, namespace import는 원본을 유지하고 diagnostic을
  반환한다.
- metadata ID는 normalized relative file path와 component name으로 만든다.
- HMR dispose 시 file metadata가 같은 consumer edge를 모든 active runtime에서
  제거한다. Replacement module 등록과 경쟁하지 않도록 cleanup을 250ms 지연하고
  동일 file이 다시 등록되면 취소한다.
- 기본 transform 범위는 Vite root 내부 source다. Root 외부 monorepo package는
  명시적 `include`가 있을 때만 검사한다.

## Hook 순서

원본 hook call 하나를 tracked hook call 하나로 교체한다. 기존 atom과 options 인자
순서는 유지하고 metadata를 두 번째 인자로 삽입한다. Tracked hook 내부 hook 구성은
항상 동일하므로 React hook 순서가 render 사이에 달라지지 않는다.

## Production 정책

Vite plugin은 build command에 적용되지 않는다. Example은 devtool provider와 UI를
`import.meta.env.DEV` 분기 안에서 dynamic import하므로 production artifact에 virtual
module, tracked hook, panel CSS가 포함되지 않아야 한다.

## HMR 정책

React effect cleanup이 일반적인 component 교체를 처리하지만 module이 제거되거나
React Refresh가 state를 보존하는 경우를 위해 explicit file cleanup을 추가한다.
변환된 module은 `import.meta.hot.dispose` callback을 등록하고 RuntimeGraph의
`releaseConsumersByFile(file)`을 호출한다. 다음 render에서 새 hook effect가 관계를
다시 등록한다.

## 검토한 대안

### 문자열/정규식 transform

alias, scope, TypeScript/JSX, source map을 안전하게 처리할 수 없어 기각했다.

### React DevTools global hook

private Fiber 구조와 hook list에서 atom identity를 안정적으로 복원할 수 없어
기각했다.

### 모든 함수 scope 변환

custom hook을 component처럼 표시해 잘못된 graph를 만들 수 있으므로 기각했다.
M4에서는 diagnostic을 제공하고 향후 hook-to-component propagation 설계 후
지원한다.

### production에서도 변환

debug metadata와 runtime effect를 사용자 bundle에 남기므로 기각했다.

## 영향

- Vite가 첫 공식 bundler integration이 된다.
- Babel plugin은 별도 package로 제공해 향후 다른 bundler가 재사용할 수 있다.
- custom hook 중심 애플리케이션은 일부 관계에 수동 tracked hook이 계속 필요하다.
- component rename은 metadata ID 변경으로 처리되며 HMR cleanup이 이전 ID를
  제거한다.
