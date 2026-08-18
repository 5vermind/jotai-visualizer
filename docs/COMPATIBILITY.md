# Compatibility

## 0.1 지원 범위

| Layer | Supported |
| --- | --- |
| Node.js | `>=20.18.1` |
| React | `>=18.3.1 <20` |
| React DOM | `>=18.3.1 <20` |
| Jotai | `>=2.20.0 <3` |
| Vite | `>=6.4.0 <7` |
| Babel core | `^7.29.0` |
| pnpm workspace | `10.28.x` |

검증된 조합:

| Matrix | Node | React | Jotai | Vite | Result |
| --- | --- | --- | --- | --- | --- |
| minimum-react18 | 20.18.1 | 18.3.1 | 2.20.0 | 6.4.3 | pass |
| current-react19 | 22 | 19.2.8 | 2.20.2 | 6.4.3 | pass |

`.github/workflows/compatibility.yml`이 두 조합에서 install, lint, typecheck,
42개 test, package build, 500-node benchmark, production tree-shaking을 실행한다.

## Jotai 패턴

### Primitive와 conditional derived atom

지원한다. Derived atom이 조건에 따라 dependency를 바꾸면 이전 edge를 제거하고
새 edge를 추가한다.

### Async/Suspense atom

mounted/subscribed async atom의 pending Promise, dependency, resolve/reject 결과를
지원한다. RuntimeGraph는 Promise settle 결과를 value preview와 revision에 반영한다.

현재 adapter는 Jotai의 mounted atom 목록을 사용한다. 최초 render에서 Suspense로
중단되어 commit되지 않았고 다른 subscriber도 없는 atom은 pending 동안 목록에
나타나지 않는다. 별도 subscriber가 있거나 Promise가 resolve되어 component가
commit되면 수집된다.

### atomFamily

지원한다. Family member는 runtime object identity별 node가 되며 각 member의
mount/unmount lifecycle을 독립적으로 반영한다. 읽기 쉬운 표시를 위해 생성된
member에 `debugLabel`을 지정하는 것을 권장한다.

### Nested Provider와 multiple Store

지원한다. 동일 atom object도 Store마다 별도 node/value를 가진다. Nested Provider가
unmount되면 inner Store의 collector와 consumer만 제거되고 outer Store는 유지된다.

### Private atom

Collector가 수집하고 UI가 기본적으로 숨긴다. `Private atoms` toggle로 canvas와
detail traversal에 함께 표시한다.

## Value preview

다음 값을 예외 없이 축약한다.

- Error
- Promise pending/fulfilled/rejected
- Map과 nested Map
- Set과 nested Set
- BigInt
- circular object/collection

Preview는 기본 비활성화이며 redaction callback을 먼저 적용한다.

## Automatic instrumentation

지원:

- `jotai`, `jotai/react` named import
- aliased `useAtom`, `useAtomValue`, `useSetAtom`
- named PascalCase function/arrow component
- `memo`, `forwardRef` wrapper
- TypeScript, TSX, JSX

미지원:

- custom hook에서 최종 component로 identity 전파
- namespace/computed hook call
- Vite root 밖 source의 암묵적 계측
- Babel 8
- Vite 이외 bundler integration

## Version 제한 이유

- Built-in headless inspector가 Jotai `2.20.0` 이상의 private Rev3 store API를
  사용한다.
- Jotai 3은 private API compatibility가 검증되지 않았다.
- Vite 6.0은 현재 Vitest 4 module runner와 호환되지 않아 하한을 6.4로 둔다.
- Vite 7/8은 현재 프로젝트의 Node 20.18 기준선보다 높은 Node version을 요구한다.
- Babel 8도 더 높은 Node 기준선을 요구해 Babel 7을 사용한다.

## Matrix 재현

Compatibility workflow는 ephemeral checkout에서 다음 스크립트로 dependency
version을 치환한다.

```sh
node scripts/set-compat-versions.mjs
pnpm install --no-frozen-lockfile
pnpm check
```

일반 개발 환경에서는 committed lockfile을 사용해야 하며 이 스크립트를 직접
실행하지 않는 것을 권장한다.
