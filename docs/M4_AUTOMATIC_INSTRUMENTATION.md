# M4 Automatic Instrumentation

M4는 Vite 개발 서버에서 일반 Jotai hook을 자동으로 tracked hook으로 바꾼다.
애플리케이션 source와 TypeScript가 보는 API는 기존 Jotai 그대로 유지된다.

## Vite 설정

```ts
// vite.config.ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import jotaiVisualizer from '@jotai-visualizer/vite'

export default defineConfig({
  plugins: [jotaiVisualizer(), react()],
})
```

`jotaiVisualizer()`는 `enforce: 'pre'`, `apply: 'serve'` plugin이다. React/TypeScript
transform 전에 metadata를 주입하며 `vite build`에서는 실행되지 않는다.

기본적으로 Vite root 내부의 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.mts`, `.cjs`,
`.cts`만 검사하고 `node_modules`와 root 외부 workspace package는 제외한다.
root 외부 application source가 필요하면 `include`를 명시한다.

```ts
jotaiVisualizer({ include: /packages\/feature/ })
```

## 지원하는 hook

`jotai` 또는 `jotai/react`의 named import를 지원한다.

- `useAtom` → `useTrackedAtom`
- `useAtomValue` → `useTrackedAtomValue`
- `useSetAtom` → `useTrackedSetAtom`

alias도 지원한다.

```tsx
import { useAtom as useCount } from 'jotai'

function Counter() {
  const [count, setCount] = useCount(countAtom)
}
```

원본 options는 metadata 뒤의 세 번째 인자로 이동하며 원래 객체를 그대로
사용한다. Source typecheck는 변환 전 `useCount`를 검사하므로 Jotai의 overload와
return type이 유지된다.

## Component metadata

named PascalCase function, function expression, variable arrow, `memo` 또는
`forwardRef`로 감싼 component를 인식한다.

```ts
{
  id: 'src/Counter.tsx#Counter',
  name: 'Counter',
  file: 'src/Counter.tsx',
  line: 4,
  column: 0,
}
```

ID는 Vite root 기준 normalized file path와 component 이름으로 구성한다.

## Virtual runtime module

변환 결과는 다음 virtual module에서 tracked API를 가져온다.

```text
virtual:jotai-visualizer/runtime
```

이 module은 React runtime package의 다음 export만 다시 노출한다.

- tracked hooks
- `registerVisualizerModule`

## HMR cleanup

계측된 module은 `import.meta.hot.dispose` callback을 등록한다. Cleanup은 250ms
지연되며 같은 file의 replacement module이 등록되면 취소된다.

- 정상 update: 기존 consumer를 보존하거나 React effect dependency가 변경된
  관계만 교체
- file 제거 또는 모든 계측 hook 제거: 지연 cleanup이 source file consumer 제거
- component 제거/rename: React Refresh unmount cleanup과 file cleanup으로 이전 ID
  제거

RuntimeGraph Provider는 mount되어 있는 동안 active runtime registry에 참여한다.

## Diagnostic

안전하게 변환할 수 없는 패턴은 source를 그대로 두고 Vite warning을 출력한다.

- custom hook 내부 호출
- anonymous/lowercase function scope
- namespace import (`Jotai.useAtom`)
- direct call이 아닌 hook reference
- 잘못된 인자 수
- spread argument

Custom hook은 자동 component propagation이 설계되기 전까지 수동 tracked hook을
사용해야 한다.

## Production 제거

Visualizer provider와 UI도 production bundle에서 제거하려면 dev root를 dynamic
import한다.

```tsx
if (import.meta.env.DEV) {
  void import('./DevRoot.js').then(({ DevRoot }) => {
    root.render(<DevRoot />)
  })
} else {
  root.render(<Application />)
}
```

현재 example production artifact에서 다음 marker가 없음을 검증한다.

- `virtual:jotai-visualizer/runtime`
- `useTrackedAtom`
- `data-jotai-visualizer`
- React Flow CSS/class

M3 dev build 대비 production JavaScript gzip 크기는 약 151KB에서 66KB로 줄고,
Visualizer CSS도 제거된다.

## 검증

- Babel fixture와 source map
- 세 hook 및 alias transform
- options와 call order 보존
- unsupported diagnostic
- Vite virtual module과 root filtering
- StrictMode consumer regression
- HMR replacement 보존 및 removed-file cleanup
- Chrome에서 자동 component graph 8 nodes / 10 edges
- Counter runtime update 후 graph 유지
- production artifact marker 검사

## 알려진 제한

- custom hook이 소비하는 atom을 최종 component로 전파하지 않는다.
- namespace import와 computed property call은 변환하지 않는다.
- Vite가 첫 공식 bundler integration이다.
- Babel 8은 현재 프로젝트 Node 20 기준선과 호환되지 않아 Babel 7을 사용한다.
- production package publish/export 검토는 M6 범위다.
