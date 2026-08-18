# M6 First Open-source Release 계획

> 작성일: 2026-08-18
> 목표 버전: `0.1.0`
> 상태: 완료 — GitHub `v0.1.0` release published

## 릴리스 채널

1. GitHub tag/release `v0.1.0`
2. Release asset으로 5개 npm-compatible tarball 제공
3. npm provenance publish workflow 준비
4. npm registry publish는 `@jotai-visualizer` organization과 인증 설정 후 실행

현재 로컬 npm CLI는 미인증이며 organization scope 권한을 확인할 수 없다. 사용자
요청 없이 package scope를 변경하지 않고 project 이름과 기존 API를 유지한다.

## 공개 package

- `@jotai-visualizer/core`
- `@jotai-visualizer/ui`
- `@jotai-visualizer/react`
- `@jotai-visualizer/babel-plugin`
- `@jotai-visualizer/vite`

## 구현 순서

1. 모든 public package version, exports, files, metadata를 `0.1.0`으로 확정한다.
2. dist-only export와 CSS asset 포함 여부를 검사한다.
3. package별 README/LICENSE와 root CHANGELOG/SECURITY/PRIVACY 문서를 추가한다.
4. tag 기반 GitHub release workflow와 수동 npm provenance workflow를 추가한다.
5. 5개 package tarball을 생성하고 내용물을 audit한다.
6. 새 임시 Vite consumer에 tarball만 설치해 typecheck/dev/build를 검증한다.
7. repository example을 최종 dogfooding한다.
8. `v0.1.0` tag와 GitHub release를 생성하고 artifact를 확인한다.

## 완료 조건

- clean checkout에서 `pnpm check` 통과
- `pnpm pack` tarball에 source/test/private file이 포함되지 않음
- tarball consumer의 dev transform과 production tree-shaking 통과
- compatibility matrix 통과
- GitHub release asset 5개와 release notes 공개
- npm publish 미실행 시 이유와 실행 절차를 release 문서에 명시
