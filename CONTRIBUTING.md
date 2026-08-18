# Contributing to Jotai Visualizer

Jotai Visualizer는 초기 설계 단계의 오픈소스 프로젝트입니다. 기능 구현 전
[프로젝트 로드맵](docs/PROJECT_ROADMAP.md)에서 현재 milestone과 제외 범위를
확인해 주세요.

## 개발 환경

- Node.js 20.18.1 이상
- pnpm 10.28.x

```sh
pnpm install
pnpm check
pnpm dev
```

`pnpm check`는 lint, typecheck, test, build를 순서대로 실행합니다.

## 변경 원칙

- 현재 milestone의 완료 조건에 직접 기여하는 작은 변경을 선호합니다.
- Jotai나 React의 비공개 API는 adapter 경계 밖에서 사용하지 않습니다.
- 새로운 dependency를 추가할 때 역할, bundle 영향, 검토한 대안을 PR에
  기록합니다.
- 동작 변경에는 회귀 테스트를 먼저 추가합니다.
- production 애플리케이션의 동작과 번들에 계측 코드가 남지 않도록 합니다.

## Pull request

PR에는 다음 내용을 포함해 주세요.

1. 해결하려는 문제와 변경 이유
2. 선택한 접근 방식과 포기한 대안
3. 실행한 검증 명령
4. 남아 있는 위험 또는 검증하지 못한 항목

커밋 메시지는 변경 내용보다 변경 이유를 먼저 설명하고, 필요하면 다음 Git
trailer를 사용합니다.

```text
Confidence: high
Scope-risk: narrow
Tested: pnpm check
Not-tested: browser extension integration
```

## 버그 리포트

가능하면 최소 재현 저장소와 함께 Jotai, React, bundler, 브라우저, Node.js 버전을
제공해 주세요. 상태 값이나 screenshot에는 민감한 정보가 포함되지 않았는지
확인해 주세요.
