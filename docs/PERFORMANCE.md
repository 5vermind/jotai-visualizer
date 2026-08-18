# Performance

## M5 성능 예산

| Scenario | Budget |
| --- | ---: |
| RuntimeGraph 500 nodes / 499 edges sync | 250ms |
| 500-node search filter | 100ms |
| Dagre 500-node layout | 2,000ms |
| Development browser panel-ready | 4,000ms |
| Development browser search response | 1,000ms |

## 측정 결과

2026-08-18 로컬 Node 20.18.1 기준:

| Scenario | Result |
| --- | ---: |
| RuntimeGraph sync | 2.25ms |
| Search filter | 1.01ms |
| Dagre layout | 86.66ms |
| Chrome panel-ready | 1,265ms |
| Chrome search `benchmarkAtom499` | 115ms |
| React Flow DOM nodes at initial viewport | 16 / 500 |

React Flow의 `onlyRenderVisibleElements`를 활성화해 500개 graph node 중 viewport에
보이는 node만 DOM에 mount한다. Graph snapshot과 minimap에는 500 nodes/499 edges가
유지된다.

측정값은 machine과 browser 상태에 따라 달라질 수 있으므로 공개 계약은 실제값이
아니라 위의 넓은 budget이다.

## 재현

### Node benchmark

```sh
pnpm benchmark
```

`scripts/benchmark-graph.mjs`가 500-node chain을 만들고 runtime sync, search filter,
Dagre layout을 측정한다. Budget 초과 시 exit code 1을 반환하며 `pnpm check`와 CI에
포함된다.

### Browser benchmark

```sh
pnpm dev
```

```text
http://localhost:5173/?benchmark=500
```

Header의 `500 nodes · 499 edges`가 panel-ready 신호다. 검색창에서
`benchmarkAtom499`를 검색하면 one-hop context인 `2 nodes · 1 edges`가 표시된다.

## Lifecycle 안정성

자동 테스트는 다음 반복 후 visible graph가 빈 상태임을 확인한다.

- consumer 등록/unregister와 Store release 100회
- source file이 다른 HMR dispose cleanup 100회
- atomFamily member 개별 unmount
- nested Provider inner Store unmount

ID registry는 WeakMap을 사용한다. Visible graph가 비어 있는 것은 강한 참조를 가진
node/edge map이 정리됐음을 증명하지만 JavaScript engine의 실제 GC 실행 시점을
보장하지는 않는다.

## 현재 성능 제한

- 500-node benchmark는 synthetic chain이며 실제 복잡한 graph 분포와 다를 수 있다.
- 전체 Dagre layout은 topology 변경 또는 Re-layout 요청에서 동기적으로 실행된다.
- 1,000개 이상 graph, Web Worker layout, progressive clustering은 아직 검증하지
  않았다.
- React Flow minimap은 전체 graph를 요약하므로 초대형 graph에서 추가 비용이 생길
  수 있다.
