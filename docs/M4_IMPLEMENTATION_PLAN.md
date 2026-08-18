# M4 Automatic Instrumentation 구현 계획

> 작성일: 2026-08-18
> 상태: 완료

## 목표

개발자가 Jotai hook을 tracked hook으로 수동 교체하지 않아도 Vite 개발 서버가
component/source metadata를 주입한다. production build와 원본 TypeScript API에는
영향을 주지 않는다.

## 기존 동작 보호

- tracked hook 내부의 Jotai hook 호출 순서는 변경하지 않는다.
- metadata 인자만 추가하고 기존 atom/options 인자는 그대로 보존한다.
- M1 StrictMode consumer lifecycle 테스트를 유지한다.
- M2 RuntimeGraph lifecycle과 M3 UI 테스트를 유지한다.

## 구현 순서

1. AST transform 범위와 unsupported syntax 정책을 ADR로 확정한다.
2. Babel plugin fixture를 먼저 작성한다.
3. direct/aliased Jotai hook import를 tracked hook 호출로 변환한다.
4. component ID, name, file, line, column metadata를 주입한다.
5. unsupported custom hook/anonymous scope/namespace import diagnostic을 제공한다.
6. Vite pre-transform과 virtual runtime module을 구현한다.
7. module dispose 시 source file consumer를 정리하는 HMR lifecycle을 연결한다.
8. example을 원본 Jotai hook으로 복원하고 dev transform으로 관계가 수집되는지
   검증한다.
9. production entry에서 devtool을 dynamic import하고 build artifact에서 제거됐는지
   검사한다.

## 변환 예시

```tsx
import { useAtom as useCount } from 'jotai'

function Counter() {
  const [count, setCount] = useCount(countAtom, { store })
}
```

```tsx
import { useTrackedAtom as _jvUseAtom } from 'virtual:jotai-visualizer/runtime'

function Counter() {
  const [count, setCount] = _jvUseAtom(
    countAtom,
    {
      id: 'src/Counter.tsx#Counter',
      name: 'Counter',
      file: 'src/Counter.tsx',
      line: 3,
      column: 0,
    },
    { store },
  )
}
```

## 완료 증거

- fixture output과 source map
- aliased import와 세 hook 변환 test
- existing options/order 보존 test
- unsupported pattern diagnostics test
- virtual module과 `apply: 'serve'` test
- HMR file cleanup integration test
- StrictMode regression test
- development browser graph consumer 확인
- production JS/CSS artifact devtool marker 부재 확인
