# Git / 배포 메모

## 1. 가장 자주 쓰는 배포

```powershell
git add .
git commit -m "Apply latest fixes"
git push
npm run build
firebase deploy --only hosting
```

운영 URL: **https://sjh-sgb.web.app**  
GitHub는 원본 저장소, 실제 앱 배포는 Firebase Hosting으로 진행합니다.

npm run build
firebase deploy --only hosting

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

## 6. Firebase Hosting 사이트가 바로 안 바뀔 때

1. `npm run build`
2. `firebase deploy --only hosting`
3. iOS 홈 화면 앱을 완전히 종료 후 다시 열기
4. 그래도 그대로면 Safari에서 `https://sjh-sgb.web.app` 새로고침

## 7. 배포 에러 확인 순서

1. GitHub 저장소 `Actions` 탭
2. 실패한 실행 클릭
3. 빨간 줄이 있는 step 클릭
4. 에러 문장 복사 후 Claude에게 붙여넣기

## 8. Firebase 관련 확인

GitHub `Settings` → `Secrets and variables` → `Actions`  
아래 7개가 있어야 합니다.

```txt
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
```

## 9. 계정 아이디

```txt
엄마: yhhojt970
손지희: sjh150717
손가빈: sgb170101
```

## 10. 비밀번호 변경

1. 사이트 로그인
2. 오른쪽 위 `설정`
3. 현재 비밀번호 / 새 비밀번호 입력
4. `비밀번호 변경하기`

## 11. 사용량 측정

```powershell
npx claude-token-meter
```

## 12. Cloud Functions / 푸시 알림 배포

앱을 닫아도 가족 메시지 알림이 도착하려면 Cloud Functions까지 배포해야 합니다.

```powershell
firebase deploy --only functions,firestore:rules
```

Firebase Console → Project settings → Cloud Messaging → Web Push certificates에서 public key를 만들고 GitHub Actions 변수 `VITE_FIREBASE_VAPID_KEY`에 추가하세요.
