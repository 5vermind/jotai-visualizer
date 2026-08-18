# Jotai Visualizer

Jotai의 atom, atom 간 의존성, 그리고 atom을 소비하는 React 컴포넌트를
실시간 그래프로 보여주는 오픈소스 개발 도구입니다.

## 프로젝트 목표

다음 질문에 빠르게 답할 수 있는 시각화 도구를 만드는 것이 목표입니다.

- 현재 어떤 atom이 마운트되어 있는가?
- derived atom은 어떤 atom에 의존하는가?
- 어떤 컴포넌트가 atom을 읽거나 쓰는가?
- 상태 변경이 어느 atom과 컴포넌트로 전파되는가?
- 여러 Jotai Store가 서로 올바르게 격리되어 있는가?

## 현재 상태

M2 Graph Core 구현을 완료했으며 M3 Embedded Visualizer를 준비하고 있습니다.
구현 범위, 아키텍처, 단계별 완료 조건은
[프로젝트 로드맵](docs/PROJECT_ROADMAP.md)을 기준으로 관리합니다.

## 첫 번째 릴리스의 모습

Vite 기반 React 애플리케이션에서 개발 모드에만 Visualizer를 활성화합니다.

```ts
// vite.config.ts
import jotaiVisualizer from '@jotai-visualizer/vite'

export default defineConfig({
  plugins: [react(), jotaiVisualizer()],
})
```

```tsx
import { JotaiVisualizer } from '@jotai-visualizer/react'

function App() {
  return (
    <>
      <Application />
      {import.meta.env.DEV && <JotaiVisualizer />}
    </>
  )
}
```

초기 버전은 애플리케이션 내부의 floating panel로 제공하고, 브라우저 확장은
런타임 Collector와 UI가 안정된 이후 별도 transport로 확장합니다.

## 개발

Node.js 20.18.1 이상과 pnpm 10.28.x가 필요합니다.

```sh
pnpm install
pnpm check
pnpm dev
```

- `pnpm check`: lint, typecheck, test, build 전체 검증
- `pnpm dev`: Vite + React + Jotai 개발 example 실행

## 문서

- [프로젝트 로드맵](docs/PROJECT_ROADMAP.md)
- [M1 Runtime Spike 사용법](docs/M1_RUNTIME_SPIKE.md)
- [Graph Core 계약](docs/GRAPH_CORE.md)
- [M2 구현 계획 및 결과](docs/M2_IMPLEMENTATION_PLAN.md)
- [ADR 0001: jotai-devtools runtime adapter](docs/adr/0001-jotai-devtools-runtime-adapter.md)
- [기여 가이드](CONTRIBUTING.md)

## 라이선스

[MIT](LICENSE)
