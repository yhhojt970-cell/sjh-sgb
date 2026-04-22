# 지희/가빈 스케줄 (GitHub Pages + 동기화)

정적 웹앱(Vite + React)이며, 로그인/데이터 동기화는 **Firebase Authentication(아이디/비밀번호) + Firestore**를 사용합니다.

## 동작 방식

- 아이디/비밀번호로 로그인
- 그룹 코드로 같은 “그룹(집)”에 참가
- 같은 그룹 코드 사용자끼리 일정/메모/기간/팔레트가 실시간 공유

## 로컬 실행

```bash
npm install
npm run dev
```

## Firebase 설정(필수)

1) Firebase 콘솔에서 프로젝트 생성  
2) Authentication → Sign-in method → **Email/Password 활성화**  
3) Firestore Database 생성  
4) Project settings → Your apps(웹) 추가 → Web config 확인  
5) `.env.example`을 `.env`로 복사 후 값 채우기

## Firestore 보안 규칙

`firestore.rules`를 Firestore Rules에 적용하세요.

## GitHub Pages 배포

1) GitHub에 `main` 브랜치로 push  
2) GitHub 저장소 → **Settings → Pages → Build and deployment → Source: GitHub Actions** 선택  
3) GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret** 에 아래 값을 등록

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

4) `Deploy to GitHub Pages` 워크플로우가 실행되면 배포 URL이 생깁니다.
