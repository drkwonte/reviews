# 틀리GO - 오답노트 웹앱

## 개발 환경 설정

```bash
npm install
npm run dev
```

## 환경변수

`.env` 파일에 아래 변수를 설정하세요:

```
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
VITE_GEMINI_API_KEY=AIzaSy...
```

## 기술 스택

- React 19 + TypeScript + Vite
- Tailwind CSS + ShadCN UI
- Supabase (DB + Auth + Storage + Edge Functions)
- React Router v7
- KaTeX (수식 렌더링)

## 배포

Cloudflare Pages → `public/_redirects` 포함 자동 SPA 라우팅 적용
