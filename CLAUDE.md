# SJH-SGB 스케줄 앱 — Claude 작업 참조 문서

> 이 파일은 Claude와 대화를 이어갈 때 매번 설명 없이 바로 작업하기 위한 참조 문서입니다.

---

## 앱 개요

- **이름**: 손지희·손가빈 스케줄 관리 앱
- **목적**: 두 아이(지희·가빈)의 일일 스케줄 관리, 코인(보상) 시스템, 용돈기입장, 보상 관리
- **사용자**: 엄마(관리자, `yhhojt970`), 손지희(`sjh150717`), 손가빈(`sgb170101`)
- **배포**: GitHub Pages (push → GitHub Actions 자동 배포)
- **백엔드**: Firebase Firestore (클라우드 동기화), localStorage (오프라인 폴백)

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | React (Vite) |
| 스타일 | 인라인 스타일 (CSS-in-JS) + `src/styles.css` |
| DB | Firebase Firestore (`setDoc` with `{ merge: true }`) |
| 인증 | Firebase Auth |
| DnD | `@dnd-kit/core` (과목 팔레트 → 타임그리드 드래그) |
| 아이콘 | `lucide-react` |
| 날짜 | `date-fns` (`format`, `startOfWeek` 등) |

---

## 파일 구조

```
src/
  App.jsx            — 라우팅, Firebase 초기화, 로그인 처리
  Dashboard.jsx      — 메인 화면 (헤더, 타임그리드, 모든 모달)
  TimeGrid.jsx       — 시간표 그리드 + TaskCard 컴포넌트
  SubjectPalette.jsx — 과목 팔레트 (드래그용 템플릿 목록)
  firebase.js        — Firebase 초기화 및 secondary app export
  styles.css         — 공통 클래스 (modal-overlay, btn-primary 등)
```

---

## 핵심 데이터 구조

### Firestore 경로
```
households/{householdId}/kids/{kidId}   — 아이별 상태 (tasks, doneLogs 등)
households/{householdId}/meta/subjects  — 공통 과목 (레거시)
households/{householdId}/meta/coinLogs  — 코인 변경 로그
households/{householdId}/meta/messages  — 가족 메시지
```

### kidState (아이별 Firestore 문서)
```js
{
  tasks: Task[],
  doneLogs: DoneLog[],
  allowanceEntries: AllowanceEntry[],
  allowanceCoinReward: number,   // 용돈기입장 작성 시 지급 코인 (기본 1)
  rewards: Reward[],
  essentials: Essential[],
  spentCoins: number,
  subjects: Subject[],
}
```

### Task
```js
{
  id: string,
  name: string,
  type: 'study' | 'class' | 'event',
  startTime: 'HH:mm',
  duration: number,           // 분
  expectedEndTime: 'HH:mm',
  color: string,              // hex
  coins: number,
  date: string,               // 'yyyy-MM-dd' (완료한 날)
  completed: boolean,         // 레거시
  memo: string,
  // class 전용
  weekday: string,            // '1'~'5'
  startDate: string,
  endDate: string,
}
```

### DoneLog (완료 기록)
```js
{
  id: string,                 // 보통 `${taskId}-${date}`
  taskId: string,
  name: string,
  type: string,               // task.type 또는 'allowance-coin'
  date: 'yyyy-MM-dd',
  status: 'completed',
  coins: number,
  coinHistory: [{ from, to, changedAt }],  // 코인 수정 이력
  allowanceId?: string,       // type='allowance-coin'일 때 연결된 allowanceEntry.id
  autoCompleted?: boolean,
  editRequested?: boolean,
}
```

### AllowanceEntry (용돈기입장)
```js
{
  id: string,
  date: 'yyyy-MM-dd',
  type: 'income' | 'expense',
  amount: number,
  title: string,
  memo: string,
}
```

---

## 코인 시스템

### 계산 방식
```js
availableCoins = doneLogs.reduce(sum(coins)) + legacyCoins - spentCoins
todayCoins     = dailyActivityLogs.reduce(sum(coins))
```
- `legacyCoins`: doneLogs 없는 구형 completed task
- `spentCoins`: 보상 지급 시 차감

### 코인 수정 플래그 (onUpdateTask)
| 플래그 | 의미 |
|--------|------|
| `_doneLogCoinsUpdate: N` | 해당 task의 오늘 doneLog 코인을 N으로 업데이트 |
| `_logOnlyUpdate: true` | class task scope 다이얼로그 건너뛰고 doneLog만 갱신 |

### 코인 수정 경로
1. **카드 편집 폼** (TimeGrid) — 엄마만 코인 수정 가능 (`isAdmin` 체크)
2. **기록관리 모달** (Dashboard) — 엄마만 접근 (`isAdmin` gate)
3. **과목 총관리 팔레트** — scope 다이얼로그 표시 (기본 설정만 / 오늘 일정도 / 전체 일정도)
4. **용돈기입장 작성** — 아이가 저장 시 `allowanceCoinReward`코인 자동 지급

### 코인 수정 시 다이얼로그
- **카드 편집 (일반 task)**: "이번 기록만 저장" / "기본 설정도 변경"
- **카드 편집 (class task)**: scope prompt → `_logOnlyUpdate` 또는 `updateFixedClassTask`
- **과목 팔레트 ±버튼**: "기본 설정만" / "오늘 일정도" / "전체 일정도" / "취소"

---

## 주요 컴포넌트 패턴

### TaskCard (TimeGrid.jsx)
- `displayCoins` = 완료됐으면 `todayLog.coins`, 아니면 `task.coins`
- `coinTier` = `getCoinTierStyle(displayCoins, color, isDone, isClassTask)` → 카드 배경/테두리/그림자 변경
- 코인 수에 따른 시각화: ★ 별 표시 (최대 3개, 4개+는 ×N), 왼쪽 테두리 두께·진하기·색상

### 코인 티어 시각화
| 코인 | 왼쪽 테두리 | 배경 | 그림자 |
|------|------------|------|--------|
| 0 | 3px, 25% 투명 | 회색빛 | 거의 없음 |
| 1 | 4px, 53% | 기본 | 가벼운 |
| 2 | 5px, 80% | 컬러 살짝 | 컬러 glow |
| 3 | 6px, 100% | 컬러 뚜렷 | 강한 glow |
| 4+ | 8px, 금색 | 따뜻한 노란빛 | 황금빛 glow |

### persistKidState (Dashboard.jsx)
```js
await persistKidState({ tasks, doneLogs, ... })
// = setDoc(kidRef, { tasks, rewards, essentials, spentCoins, allowanceEntries, doneLogs, ...overrides }, { merge: true })
```

### onUpdateTask (Dashboard.jsx)
```js
// class task이면 scope 선택 후 updateFixedClassTask 호출
// 일반 task이면 tasks 배열 업데이트
// _doneLogCoinsUpdate 있으면 applyDoneLogCoinUpdate 호출
// _logOnlyUpdate 있으면 doneLog만 업데이트하고 즉시 return
```

---

## 권한 (isAdmin vs 아이)

| 기능 | 엄마 | 아이 |
|------|------|------|
| 코인 수정 | O | X |
| 기록관리 모달 | O | X |
| 과목 총관리 | O | X |
| 고정수업 관리 | O | X |
| 카드 편집 (class) | O | X (수정요청만) |
| 카드 편집 (일반) | O | O (코인 제외) |
| 용돈기입장 작성 | O | O (+코인 지급) |
| 보상 지급 | O | X |

---

## 용돈기입장 코인 연동

- 아이가 용돈기입장 저장 → `type:'allowance-coin'` doneLog 자동 생성 (`allowanceId` 연결)
- 용돈기입장 삭제 → 연결된 doneLog도 함께 삭제
- 엄마가 지급 코인 수 설정: 코인/보상 모달 → "용돈기입장 작성 코인" (`allowanceCoinReward`)
- 기록관리에서 "용돈기입장 작성" 항목으로 확인·수정·삭제 가능

---

## 기록관리 (dailyLog) 모달

- 날짜별 완료 기록, 용돈기입장, 코인 변경 로그 통합 표시
- `logType`: `'activity'` | `'coin'` | `'allowance'`
- 엄마만 접근 (`{showDailyLog && isAdmin && ...}`)
- 코인 수정 → `saveLogEdit()` → coinHistory 배열에 이력 추가

---

## Task 삭제 정책

- 태스크 삭제 시 해당 `taskId`의 **모든 날짜** doneLog 함께 삭제
- 코인 합산에서도 자동 제외

---

## 주요 스타일 상수

```js
PRIMARY_PINK = '#ff4d6d'
LIGHT_PINK   = '#fff0f3'
```

---

## buildCoinEntries (코인 획득 내역)

- `doneLogs`에서 `status === 'completed' && coins > 0` 항목 추출
- `seenTaskDates` Set으로 중복 제거 (`String(taskId)-date` 키)
- 레거시 task(doneLog 없는 completed task)도 포함
- 날짜별 그룹화: `+{group.total} / {cumulativeAtDay}코인` 형식

---

## 금액 표시

```js
const formatAmount = (n) => Number(n || 0).toLocaleString('ko-KR')
// → 10000 → "10,000"
```

---

## 자주 하는 작업 체크리스트

새 기능 추가 시:
- [ ] 엄마/아이 권한 분리 (`isAdmin` 체크)
- [ ] 저장: `persistKidState({ 변경된_필드 })`
- [ ] 코인 관련이면 `coinHistory` / `_doneLogCoinsUpdate` 패턴 확인
- [ ] 모바일 대응 (`isMobile` 조건부 스타일)
- [ ] 금액 표시: `formatAmount()` 사용
