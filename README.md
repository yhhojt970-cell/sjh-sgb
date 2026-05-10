# 지희/가빈 스케줄

Vite + React 정적 웹앱. 로그인·데이터 동기화는 **Firebase Auth(아이디/비밀번호) + Firestore**를 사용합니다.

## 운영 URL

**https://sjh-sgb.web.app** (Firebase Hosting)

## 동작 방식

- 아이디/비밀번호로 로그인
- 같은 그룹 코드 사용자끼리 일정·코인·팔레트 실시간 공유

## 로컬 실행

```bash
npm install
npm run dev
```

## Firebase 초기 설정

1. Firebase 콘솔에서 프로젝트 생성
2. Authentication → Sign-in method → **Email/Password 활성화**
3. Firestore Database 생성
4. Project settings → Your apps(웹) 추가 → Web config 확인
5. `.env.example`을 `.env`로 복사 후 값 채우기

## Firestore 보안 규칙

```bash
firebase deploy --only firestore:rules
```

## 앱 배포

```bash
npm run build
firebase deploy --only hosting
```

## 푸시 알림 (Cloud Functions)

앱을 닫아도 가족 메시지 알림을 받으려면 VAPID key를 `VITE_FIREBASE_VAPID_KEY`에 추가하고 함수까지 배포하세요.

```bash
firebase deploy --only functions,firestore:rules
```
