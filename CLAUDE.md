# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

React 19 + TypeScript + Vite 기반 노트 앱 **실습 프로젝트**(강의용). 기능이 의도적으로 최소화되어 있으며, `src/types/note.ts`의 주석(`❌ tags 필드는 아직 없음 — 강의에서 추가할 것`)처럼 이후 실습에서 기능을 점진적으로 추가하는 것을 전제로 한다. 기존 코드 스타일과 최소주의를 최대한 존중하고, 요청받지 않은 범위까지 미리 확장하지 않는다.

## 개발 명령어

```bash
npm run dev        # Vite 프론트(5173) + json-server(3001) 동시 실행 (개발 시 기본)
npm run server      # json-server만 단독 실행 (db.json 기반, --watch)
npm run build       # tsc 타입체크 + vite build
npm run lint         # eslint --fix
npm run format       # prettier --write
npm test            # vitest run (전체 1회 실행)
npm run test:watch  # vitest watch 모드
```

단일 테스트 파일 실행: `npx vitest run <파일경로>` (예: `npx vitest run src/components/NoteItem.test.tsx`)
단일 테스트 이름으로 실행: `npx vitest run -t "<테스트 이름>"`

프론트엔드는 API 서버(`json-server`, port 3001)가 떠 있어야 정상 동작한다. `npm run dev`가 아닌 `vite`만 단독 실행하면 노트 목록이 로딩 상태에서 멈추거나 에러가 난다.

## 아키텍처

데이터 흐름은 단방향이며 전역 상태는 Context 하나로 관리한다:

```
App.tsx (선택된 노트 id, 생성 모드 로컬 state)
  └─ NotesProvider (context/NotesContext.tsx) — notes/loading/error + CRUD 함수 제공
       └─ Layout — 헤더 + 사이드바/메인 슬롯 레이아웃 (children을 prop으로 주입받는 구조)
            ├─ NoteList → NoteItem (여러 개) — useNotes()로 목록 조회 및 삭제
            └─ NoteEditor — useNotes()로 생성/수정, 로컬 폼 state는 selectedNote 변경 시 useEffect로 동기화
```

- **상태 관리**: Redux/Zustand 없음 — `NotesContext`가 유일한 전역 상태 소스. `useNotes()` 훅으로 컴포넌트 어디서든 접근. Provider 밖에서 호출하면 즉시 throw.
- **API 계층**: `src/api/notes.ts`가 json-server(`http://localhost:3001`)에 대한 fetch 래퍼 전부를 담당. 서비스/레포지토리 레이어 분리 없이 함수형으로 단순하게 구성되어 있다 — 이 프로젝트 규모에서는 계층을 추가로 쪼개지 않는다.
- **낙관적 갱신 없음**: `createNote`/`updateNote`/`deleteNote`는 API 응답을 기다린 뒤 로컬 `notes` state를 갱신하는 방식(서버 응답을 신뢰).
- **선택/생성 모드는 상호 배타적**: `App.tsx`의 `selectedNoteId`와 `isCreating`은 항상 한쪽만 유효하도록 핸들러에서 서로를 초기화한다(`handleSelectNote`가 `isCreating`을 끄고, `handleNewNote`가 `selectedNoteId`를 비움).
- **스타일링**: Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, PostCSS 설정 파일 없음). 테마 토큰은 `src/index.css`의 `@theme` 블록에 CSS 변수로 정의(`--color-*`, `--font-*`, `--radius`). 커스텀 색상/폰트 추가 시 여기에 정의하고 Tailwind 유틸리티(`bg-foreground` 등)로 사용.
- **테스트 인프라**: Vitest + Testing Library + jsdom이 설정되어 있으나(`vite.config.ts`의 `test` 블록, `src/test-setup.ts`) 아직 테스트 파일은 하나도 없다. 새로 작성 시 `*.test.tsx` 컴포넌트 옆에 배치.

## 컴포넌트 구현 패턴

- Props는 `interface ComponentNameProps { ... }`로 정의 후 구조분해 할당으로 받는다(`type` alias는 쓰지 않음 — `Note`, `NotesContextType` 등 모든 타입이 `interface`).
- `export function ComponentName(...)` named export가 기본. `default export`는 `App.tsx` 하나뿐.
- 로딩/에러/빈 상태는 컴포넌트 최상단에서 조건부 early return으로 처리(`NoteList`, `NoteEditor`).
- 콜백 props는 `onXxx`(`onSelect`, `onDelete`, `onDone`, `onNewNote`), 그 콜백을 감싸는 내부 핸들러는 `handleXxx`(`handleSelectNote`, `handleSave`)로 구분해서 이름짓는다.
- `Layout`처럼 자식 영역을 JSX children이 아니라 `sidebar`/`main` 같은 named prop으로 주입하는 슬롯 패턴을 사용.
- 스타일은 전부 인라인 Tailwind 클래스, 조건부 클래스는 템플릿 리터럴로 직접 분기 — CSS 모듈/styled-components 없음.
- 섹션 구분용 한글 주석(`{/* 헤더 */}`, `// 선택된 노트가 바뀔 때 폼 동기화`)을 JSX/로직 블록 위에 붙이는 관례.
- **에러 처리는 `console.error`로만 한다 — `alert()` 등 브라우저 팝업으로 사용자에게 노출하지 않는다.** 검증 실패(예: 제목 미입력)와 API 실패(catch 블록) 모두 동일하게 적용.
- 컴포넌트는 반드시 named export만 사용한다.

## 상태관리 방식

- 여러 컴포넌트가 공유하는 데이터(`notes`, `loading`, `error`)와 그 CRUD 동작은 `NotesContext` 하나로만 관리 — Redux/Zustand 등 별도 상태관리 라이브러리는 쓰지 않는다.
- 컴포넌트 로컬 UI 상태(선택된 id, 생성 모드, 폼 입력값, 저장 중 플래그)는 각 컴포넌트의 `useState`에 둔다. 전역 Context로 끌어올리지 않는다.
- prop으로 내려온 값에 로컬 폼 상태를 동기화할 때는 `useEffect`를 쓴다(`NoteEditor`가 `selectedNote` 변경 시 `title`/`content`를 재세팅). 이때 `eslint-disable-line react-hooks/exhaustive-deps`로 의도적으로 의존성 배열을 제한하는 것이 이 프로젝트의 관례.
- Context의 CRUD 함수(`createNote`/`updateNote`/`deleteNote`)는 API 응답을 `await`한 뒤에만 로컬 `notes` 배열을 갱신 — 낙관적 업데이트(optimistic update) 없음. 함수명은 `api.ts`의 동사와 동일하게 맞춘다(아래 API 호출 패턴 참고).

## API 호출 패턴 (`src/api/notes.ts`)

- 엔드포인트마다 하나의 `export async function`으로 정의(`fetchNotes`, `createNote`, `updateNote`, `deleteNote`) — 클래스나 서비스 객체로 감싸지 않는다.
- 공통 처리 순서: `fetch` → `res.ok` 체크 → 실패 시 `throw new Error(...)` → 성공 시 `res.json()` 반환.
- `createNote`는 `createdAt`/`updatedAt`을 모두 현재 시각으로 채우고, `updateNote`는 `updatedAt`만 갱신 — 타임스탬프는 서버가 아니라 클라이언트에서 생성해서 보낸다.
- 컴포넌트는 `api.ts`를 직접 import하지 않고 항상 `useNotes()`를 통해서만 CRUD를 호출한다(`NotesContext`가 API 함수를 감싼 래퍼를 제공).
- `NotesContext`가 제공하는 래퍼 함수명은 `api.ts`와 동일하게 `createNote`/`updateNote`/`deleteNote`로 통일 — 레이어가 달라도 CRUD 동사는 항상 `create`/`update`/`delete`를 쓴다.

## 네이밍 컨벤션

- 파일: 컴포넌트는 PascalCase(`NoteItem.tsx`), 그 외 모듈은 camelCase(`notes.ts`, `note.ts`).
- Props 타입: `ComponentName` + `Props` 접미사(`LayoutProps`, `NoteItemProps`).
- 콜백 props는 `onXxx`, 내부 핸들러 함수는 `handleXxx`(위 컴포넌트 패턴 참고).

## ⚠️ 발견된 일관성 없는 패턴 (참고)

새 코드 작성 시 아래를 그대로 답습하지 말고, 통일 여부를 먼저 확인할 것:

1. **에러 메시지 언어 혼용**: UI 텍스트는 전부 한글인데, `api.ts`가 던지는 `Error` 메시지는 영어(`'Failed to fetch notes'` 등)이고 이 메시지가 그대로 `NotesContext`의 `error` state를 거쳐 `NoteList`에 `오류: Failed to fetch notes`처럼 그대로 노출된다.
2. **boolean state 네이밍 접두사 혼용**: `isCreating`/`isSelected`는 `is` 접두사를 쓰지만 같은 성격의 `loading`/`saving`은 접두사가 없다.
3. **API base URL 하드코딩**: `src/api/notes.ts`의 `API_URL = 'http://localhost:3001'`이 환경변수 없이 하드코딩되어 있어 배포 환경별로 분리할 수 없다.

> ~~API ↔ Context 계층 동사 네이밍 불일치~~ — `addNote`/`editNote`/`removeNote`를 `createNote`/`updateNote`/`deleteNote`로 통일하여 해결됨.

## 코드 스타일 (Prettier 설정 기준)

- 세미콜론 사용, 싱글쿼트, 2칸 들여쓰기, trailing comma(`all`), printWidth 100
- 컴포넌트는 `export function ComponentName(...)` 형태의 named export (default export는 `App`에서만 사용)
- 한글 주석으로 섹션 구분(`{/* 헤더 */}`, `// 선택된 노트가 바뀔 때 폼 동기화` 등) — 기존 관례를 따를 것

## 커밋 규칙 (husky)

- `.husky/pre-commit`: `lint-staged` 실행 — staged된 `*.ts`/`*.tsx`는 `eslint --fix` + `prettier --write`, `*.json`/`*.css`/`*.md`는 `prettier --write`. 에러가 남으면 커밋이 막힌다.
- `.husky/commit-msg`: `commitlint`(`@commitlint/config-conventional`)로 커밋 메시지 형식을 검사 — `type: subject` 형식 필수(`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style` 등). 제목/본문은 한글로 작성(`subject-case` 규칙은 비활성화되어 있어 한글 대소문자 검사는 하지 않음).
