# 지희/가빈 스케줄 (Firebase Hosting + 동기화)

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

## Firebase Hosting 배포

현재 운영 URL은 `https://sjh-sgb.web.app`입니다.

```bash
npm run build
firebase deploy --only hosting
```

GitHub는 원본 저장소로 사용하고, 실제 앱 배포는 Firebase Hosting으로 진행합니다.

## 푸시 알림

앱을 닫아도 가족 메시지 알림을 받으려면 Firebase Cloud Messaging Web Push certificate public key를 `VITE_FIREBASE_VAPID_KEY`로 추가하고 Cloud Functions를 배포하세요.

```bash
firebase deploy --only functions,firestore:rules
```
