# ADR 0002: Embedded graph는 React Flow와 Dagre로 구현한다

- 상태: Accepted
- 결정일: 2026-08-18
- 범위: M3 Embedded Visualizer

## 배경

M3에는 pan, zoom, node drag, custom node, edge styling, selection, 100 node 수준의
interaction이 필요하다. 직접 SVG renderer를 만들면 graph 기능보다 viewport와
pointer interaction 구현에 더 많은 유지보수 비용이 든다.

## 결정

- renderer: `@xyflow/react@12.11.3`
- initial layout: `@dagrejs/dagre@3.1.1`
- layout 방향: left-to-right
- layout 실행: 최초 표시, 새 node 유입, 사용자의 명시적 재배치 요청
- 사용자가 drag한 좌표는 filter나 snapshot 변경 후에도 보존

React Flow state는 Jotai 애플리케이션 Store와 분리된 React local state로 둔다.
UI package는 `@jotai-visualizer/core`만 의존하며 Jotai를 import하지 않는다.

## 이유

React Flow는 custom node, keyboard focus, viewport control과 edge renderer를 이미
제공한다. Dagre는 M3의 단순 dependency graph에 충분하고 동기식이라 worker나
별도 service 없이 초기 layout을 계산할 수 있다.

## 검토한 대안

### 직접 SVG/canvas renderer

dependency를 줄일 수 있지만 zoom/pan/drag/accessibility를 다시 구현해야 하므로
기각했다.

### ELK

compound graph와 edge routing 기능은 강력하지만 M3 구조에는 bundle과 설정 비용이
과도해 보류했다.

### 지속적인 force layout

node가 계속 움직여 debugging 중 위치 기억이 어렵고 큰 graph에서 지속적인 계산이
필요해 기각했다.

## 영향

- UI package에 두 개의 runtime dependency가 추가된다.
- React Flow stylesheet를 포함해야 한다.
- renderer-specific node/edge 모델은 `packages/ui` 밖으로 노출하지 않는다.
- M5 500-node benchmark에서 React Flow render 비용과 Dagre layout 시간을 다시
  측정한다.
