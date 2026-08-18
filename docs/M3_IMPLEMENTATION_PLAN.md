# M3 Embedded Visualizer 구현 계획

> 작성일: 2026-08-18
> 상태: 완료

## 목표

M2 Graph Core snapshot을 사용해 애플리케이션 안에서 열고 닫을 수 있는 graph
inspector를 제공한다. UI는 Jotai adapter를 직접 알지 않고 `RuntimeGraph`만
소비한다.

## 기존 동작 보호

- M1 Jotai dependency/consumer integration 테스트를 유지한다.
- M2 patch, lifecycle, traversal, redaction 테스트를 유지한다.
- panel이 닫힌 상태에서는 RuntimeGraph subscription을 만들지 않는다.
- application atom과 Visualizer 내부 UI 상태를 공유하지 않는다.

## 구현 순서

1. React Flow와 Dagre 선택을 ADR로 기록한다.
2. `@jotai-visualizer/ui` package와 snapshot-to-flow model을 구현한다.
3. floating trigger, panel shell, toolbar, graph canvas를 구현한다.
4. atom/component node와 dependency/consumer edge를 구분한다.
5. 검색, Store/private 필터, detail, upstream/downstream highlight를 연결한다.
6. atom revision 변화 highlight와 drag position 보존을 구현한다.
7. accessibility, CSS scope, 100-node model 테스트를 추가한다.
8. 테스트 앱 screenshot을 visual reference와 비교하고 90점 이상까지 수정한다.

## UI 원칙

- 개발 도구답게 정보 밀도가 높되 node label이 첫 시선에 들어와야 한다.
- atom과 component는 색상뿐 아니라 형태와 badge로도 구분한다.
- dependency와 consumer edge는 solid/dashed 패턴으로 구분한다.
- 선택하지 않은 node를 완전히 숨기기보다 주변 문맥을 유지한다.
- host application selector를 오염시키지 않도록 모든 custom selector를
  `.jv-` prefix 아래에 둔다.
- keyboard로 열기/닫기, 검색, filter, node 선택이 가능해야 한다.

## 완료 증거

- 100 node model/layout test
- closed panel zero-subscription test
- Escape/focus return 및 accessible label test
- search/Store/private filter test
- detail과 traversal highlight test
- position reconciliation test
- screenshot과 visual-verdict JSON
- lint, typecheck, test, build, production audit
