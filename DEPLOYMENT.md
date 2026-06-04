# Chalna 영구 배포 가이드

Chalna는 단순 정적 웹사이트가 아니라 **React 클라이언트, Express/tRPC 서버, MySQL 데이터베이스, 영상 파일 스토리지**가 함께 필요한 풀스택 웹앱입니다. 따라서 GitHub Pages 같은 정적 호스팅만으로는 촬영 업로드와 카드 표시 기능을 영구 운영할 수 없습니다.

## 배포 구조

| 구성 요소 | 역할 | 필수 여부 |
|---|---|---:|
| Node.js 서버 | API, OAuth 콜백, 정적 파일 서빙, 스토리지 프록시를 처리합니다. | 필수 |
| MySQL 호환 DB | 사용자, 로그방, 멤버, 시간 슬롯별 클립 메타데이터를 저장합니다. | 필수 |
| 영상 스토리지 | 업로드된 짧은 영상을 저장하고 재생 URL을 발급합니다. | 필수 |
| HTTPS 도메인 | 모바일 브라우저 카메라 권한과 OAuth 리다이렉트를 안정적으로 처리합니다. | 필수 |

## 추가된 배포 파일

| 파일 | 설명 |
|---|---|
| `Dockerfile` | Node 22 기반 프로덕션 이미지 빌드 및 실행 설정입니다. |
| `.dockerignore` | Docker 빌드 컨텍스트에서 민감 파일과 불필요한 산출물을 제외합니다. |
| `render.yaml` | Render Blueprint 방식으로 영구 웹 서비스를 만들 수 있는 예시 설정입니다. |
| `.env.example` | 프로덕션 환경 변수 목록과 의미를 정리한 예시 파일입니다. |

## 필수 환경 변수

아래 변수들은 호스팅 플랫폼의 Environment Variables 또는 Secrets 메뉴에 설정해야 합니다. 실제 운영 값은 저장소에 커밋하지 마세요.

| 변수명 | 설명 |
|---|---|
| `DATABASE_URL` | MySQL 호환 데이터베이스 연결 문자열입니다. |
| `JWT_SECRET` | 로그인 세션 서명에 사용하는 긴 랜덤 문자열입니다. |
| `VITE_APP_ID` | OAuth 앱 식별자입니다. |
| `VITE_OAUTH_PORTAL_URL` | 클라이언트가 로그인 시작 시 이동할 OAuth 포털 URL입니다. |
| `OAUTH_SERVER_URL` | 서버가 OAuth 토큰과 사용자 정보를 검증할 서버 URL입니다. |
| `OWNER_OPEN_ID` | 운영자 권한을 부여할 OpenID입니다. 필요 없으면 비워둘 수 있습니다. |
| `BUILT_IN_FORGE_API_URL` | 영상 파일 업로드와 다운로드 서명 URL을 발급하는 스토리지 API URL입니다. |
| `BUILT_IN_FORGE_API_KEY` | 스토리지 API 인증 키입니다. |

## Render 기준 배포 절차

1. GitHub 저장소를 Render에 연결합니다.
2. Render에서 Blueprint 배포를 선택하고 `render.yaml`을 인식시킵니다.
3. `sync: false`로 표시된 환경 변수를 실제 운영 값으로 입력합니다.
4. MySQL 호환 데이터베이스를 준비하고 `DATABASE_URL`을 설정합니다.
5. 최초 배포 전 또는 배포 직후 다음 명령으로 DB 마이그레이션을 실행합니다.

```bash
pnpm db:push
```

6. 배포가 완료되면 `/api/health`가 `{ "ok": true, "service": "chalna" }`를 반환하는지 확인합니다.
7. OAuth 리다이렉트 허용 도메인에 최종 배포 도메인을 등록합니다.
8. 모바일 기기에서 HTTPS 배포 URL을 열고 **로그인 → 방 생성/참여 → 촬영 → 업로드 → 카드 표시** 순서로 검증합니다.

## 로컬 프로덕션 검증

배포 전 로컬에서 다음 명령을 실행해 프로덕션 빌드가 정상인지 확인할 수 있습니다.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm start
```

Docker 기반 검증은 다음과 같이 실행합니다.

```bash
docker build -t chalna .
docker run --rm -p 3000:3000 --env-file .env chalna
```

## 현재 제한 사항

현재 앱의 영상 스토리지는 `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` 기반의 스토리지 API에 의존합니다. Render, Railway, Fly.io 같은 일반 호스팅에서 독립 운영하려면 이 두 변수를 사용할 수 있어야 하며, 그렇지 않다면 `server/storage.ts`를 AWS S3, Cloudflare R2, Supabase Storage 같은 범용 스토리지 어댑터로 교체해야 합니다.
