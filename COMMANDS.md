# Git / 배포 메모

## 1. 가장 자주 쓰는 배포

```powershell
git add .
git commit -m "Apply latest fixes"
git push
```

## 2. 수정한 파일만 올릴 때

```powershell
git add src/App.jsx src/Dashboard.jsx src/TimeGrid.jsx src/styles.css
git commit -m "Update app"
git push
```

## 3. 커밋할 게 있는지 확인

```powershell
git status
```

## 4. 최근 커밋 보기

```powershell
git log --oneline -n 5
```

## 5. 원격 저장소 확인

```powershell
git remote -v
```

## 6. push 했는데 사이트가 바로 안 바뀔 때

1. GitHub 저장소로 이동
2. `Actions` 탭 클릭
3. `Deploy to GitHub Pages` 확인
4. 초록 체크 뜰 때까지 기다리기
5. 사이트에서 `Ctrl + F5`로 새로고침

## 7. 배포 에러 확인 순서

1. GitHub 저장소 `Actions`
2. 실패한 실행 클릭
3. 빨간 줄이 있는 step 클릭
4. 에러 문장 복사
5. Codex에게 그대로 붙여넣기

## 8. Firebase 관련 확인

- GitHub `Settings` → `Secrets and variables` → `Actions`
- 아래 6개가 있어야 함

```txt
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## 9. 계정 아이디

```txt
엄마: yhhojt970
손지희: sjh150717
손가빈: sgb170101
```

## 10. 비밀번호 변경

- 사이트 로그인
- 오른쪽 위 `설정`
- 현재 비밀번호 / 새 비밀번호 입력
- `비밀번호 변경하기`

## 11. 사용량측정
npx claude-token-meter