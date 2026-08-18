# M5 Compatibility and Performance 구현 계획

> 작성일: 2026-08-18
> 상태: 완료

## 목표

M0~M4에서 구현한 runtime, adapter, UI, transform이 실제 Jotai 패턴과 지원
version 조합에서 안정적으로 동작하는지 검증하고 공개 가능한 성능 예산을 정한다.

## 지원 후보

| 구분 | Node | React | Jotai | Vite |
| --- | --- | --- | --- | --- |
| 최소 | 20.18.1 | 18.3.1 | 2.20.0 | 6.4.3 |
| 현재 | 20.18.1/22 | 19.2.8 | 2.20.2 | 6.4.3 |

Vite 6.0은 현재 Vitest 4 module runner와 호환되지 않아 지원 하한을 6.4로 둔다.
Vite 7/8은 Node 20.19 이상을 요구하므로 현재 Node 기준선에서는 지원 대상으로
선언하지 않는다.

## 성능 예산

- 500 atom/499 edge RuntimeGraph sync: 250ms 이하
- 500 node filter와 Dagre layout: 2,000ms 이하
- 500 node 개발 browser panel-ready: 4,000ms 이하
- 동일 topology의 value revision update: Dagre 재실행 없음
- 100회 mount/unmount, HMR cleanup, Store release 후 visible graph: 0 nodes/edges

CI wall-clock 변동을 고려해 unit budget은 실제 로컬 중앙값보다 충분히 넓게 두되,
예산을 초과하면 test가 실패하도록 한다.

## 구현 순서

1. Map/Set preview serializer와 특수 값 test를 완성한다.
2. async/Suspense atom과 resolve lifecycle을 integration test로 검증한다.
3. atomFamily 동적 atom mount/unmount를 검증한다.
4. nested Provider와 동일 atom의 Store 격리를 검증한다.
5. 500-node core/model/layout benchmark fixture를 추가한다.
6. 반복 consumer/HMR/Store lifecycle test를 추가한다.
7. `?benchmark=500` browser fixture와 panel-ready 측정을 추가한다.
8. 최소/현재 dependency matrix GitHub Actions를 구성한다.
9. 지원 범위, performance 결과, 알려진 제한을 문서화한다.

## 완료 증거

- 기존 조건부 dependency regression 포함 전체 test
- async pending/resolved preview 및 dependency edge
- atomFamily node 개별 cleanup
- nested Store별 값/consumer edge
- Error/Promise/Map/Set preview
- 500-node budget test와 browser 측정
- 100회 lifecycle 후 empty snapshot
- primary CI와 compatibility matrix 통과
