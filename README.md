# 🍽️ 식사일지 · 온결

식사와 칼로리, 몸무게를 하루 단위로 남기고 달력과 그래프로 확인하는 **개인용 PWA**입니다.
정적 파일만으로 동작하며, Firebase(Google 로그인 + Cloud Firestore)를 선택적으로 연결하면 기기 간 실시간 동기화가 됩니다.
Firebase 없이도 이 기기의 브라우저 저장소(localStorage)만으로 모든 기능을 쓸 수 있습니다.

---

## 1. 미리보기

| 화면 | 스크린샷 |
| --- | --- |
| 오늘 기록 (데스크톱) | `screenshots/02-desktop-record.png` |
| 오늘 기록 (모바일) | `screenshots/10-mobile-record.png` |
| 달력 | `screenshots/03-desktop-calendar.png`, `11-mobile-calendar.png` |
| 통계 · 주간 | `screenshots/04-desktop-stats-week.png` |
| 통계 · 월간 | `screenshots/05-desktop-stats-month.png` |
| 통계 · 연간 | `screenshots/06-desktop-stats-year.png` |
| 통계 · 따로 보기 | `screenshots/07-desktop-stats-split.png` |
| 목표 초과 상태 | `screenshots/08-desktop-over-goal.png` |
| 사진 크게 보기 | `screenshots/08b-desktop-lightbox.png` |
| 설정(동기화·백업) | `screenshots/09-desktop-settings.png` |
| 음식 추가(모바일 바텀시트) | `screenshots/13-mobile-modal.png` |
| 빈 상태 | `screenshots/01-desktop-empty.png` |

---

## 2. 실행

```bash
cd apps/meal-log
python3 -m http.server 8080
# 브라우저에서 http://localhost:8080
```

> `index.html`을 파일로 바로 열어도 화면은 뜨지만, PWA 설치·서비스 워커·Firebase 로그인은 **http(s) 주소**에서만 동작합니다.

배포는 정적 호스팅이면 어디든 됩니다: GitHub Pages, Netlify, Vercel, Firebase Hosting, Cloudflare Pages.
(`index.html`, `css/`, `js/`, `icons/`, `manifest.json`, `sw.js` 를 그대로 업로드)

---

## 3. 파일 구조

```
apps/meal-log/
├── index.html            # 앱 셸 (탭 3개 + 모달 4개)
├── manifest.json         # PWA 매니페스트 (아이콘·테마·바로가기)
├── sw.js                 # 서비스 워커 (앱 셸 오프라인 캐시)
├── firestore.rules       # Firestore 보안 규칙 (본인만 읽고 쓰기)
├── css/styles.css        # 디자인 토큰 + 반응형 + 컴포넌트
├── js/util.js            # 날짜/숫자 포맷, 이미지 압축, 토스트, 눈금 계산
├── js/store.js           # 데이터 계층 (localStorage, 백업, 동기화 병합)
├── js/chart.js           # SVG 선 그래프(이중 Y축/따로 보기, 꼭짓점 수치 라벨)
├── js/sync.js            # Firebase 초기화·Google 로그인·실시간 구독
├── js/app.js             # 렌더링과 이벤트
├── icons/                # 192·512·maskable·180·32 PNG
└── screenshots/          # 검증 스크린샷
```

의존성 없음(빌드 도구 없이 그대로 동작). Firebase SDK만 연결 시 CDN에서 동적으로 불러옵니다.

---

## 4. 화면과 기능

### 오늘 (기록)
- **날짜 이동**: 이전/다음 화살표, `오늘` 버튼. 미래 날짜는 `예정` 배지로 구분.
- **요약 카드**: 총 섭취(kcal), 목표 대비 **게이지(%)**, `섭취 / 목표 / 남은(초과)` 3개 수치.
  - 목표 이내 → 세이지 민트, 초과 → 앰버로 색이 바뀌고 “목표보다 N kcal 더 먹었어요”로 안내.
  - 끼니별 비중 막대 + 범례(아침·점심·저녁·간식).
- **끼니 4섹션**: 아침/점심/저녁/간식. 각 카드에서 음식 추가, 행을 눌러 수정, 휴지통으로 삭제.
  - 음식명 · 칼로리 · 메모 · **사진**. 사진은 Canvas로 **긴 변 480px / JPEG** 로 줄이고, 필요하면 품질을 0.72 → 0.4까지 낮춰 dataURL 60KB 이하로 맞춥니다. 썸네일을 누르면 원본 보기(라이트박스).
- **몸무게**: 숫자 입력(0.1kg 단위 스텝 버튼), 저장 즉시 이전 기록 대비 증감(↓민트/↑앰버)과 최근 14회 스파크라인.
- **자주 먹는 음식**: 이름·칼로리만 저장. 각 항목의 `아/점/저/간` 칩을 누르면 그 끼니에 **한 번에** 담깁니다. 음식 저장 시 “즐겨찾기에 저장” 체크로도 추가.
- **이번 주**: 일~토 7칸 막대(높이=목표 대비, 민트=이내/앰버=초과). 칸을 누르면 그 날짜로 이동.

### 달력
- 월간 그리드(6주 고정). 날짜마다 총 섭취와 목표 대비 막대, `오늘` 테두리, 선택 시 네이비 강조.
- 범례: 목표 이내 / 목표 초과 / 기록 없음.
- 하단 월 요약: 기록한 날, 평균 섭취, 목표 이내 비율.
- 날짜를 누르면 아래에 그날의 식사·사진·몸무게가 바로 보이고, **이 날짜 편집**으로 기록 탭에서 수정할 수 있습니다.

### 통계
- **주간 / 월간 / 연간** 전환 + 이전·다음 기간 이동.
- **칼로리(딥 네이비)** 와 **몸무게(세이지 민트)** 선 그래프. **함께 보기**(이중 Y축) / **따로 보기**(두 패널) 토글.
- **모든 꼭짓점에 실제 수치 라벨**을 붙입니다. 라벨끼리 또는 다른 선의 점과 겹치면 위/아래로 자동으로 밀어내 겹침을 줄입니다. 점을 가리키면 날짜·칼로리·몸무게 툴팁.
- 집계 단위: 주간=일별, 월간=주별(일~토) 평균, 연간=월별 평균. (라벨이 겹치지 않도록 한 화면에 5~12개 점으로 유지)
- 요약 카드: 기간 평균 섭취, 체중 변화(−/＋), 목표 이내 일수와 달성률.
- 기간 상세 표: 날짜·섭취·목표·몸무게·달성 여부.

### 설정
- **계정 동기화**: Firebase 구성(JSON) 붙여넣기 → 저장 → Google 로그인. 연결 후 실시간 동기화, 지금 동기화, 로그아웃, 연결 해제.
- **백업**: JSON 내보내기(사진 포함) / 불러오기(같은 날짜는 최신 `updatedAt` 우선 병합).
- **기록 관리**: 이 기기의 로컬 기록만 삭제.

---

## 5. 데이터 구조

localStorage 키: `mealLog.v2`

```jsonc
{
  "version": 2,
  "days": {
    "2026-11-19": {
      "date": "2026-11-19",
      "weight": 72.4,                       // kg, 없으면 null
      "meals": [
        { "id": "…", "type": "breakfast",   // breakfast|lunch|dinner|snack
          "name": "오트밀 40g과 바나나", "kcal": 320, "note": "출근 전",
          "photo": "data:image/jpeg;base64,…", // 480px JPEG, 없으면 null
          "createdAt": 1732000000000, "updatedAt": 1732000000000 }
      ],
      "updatedAt": 1732000000000
    }
  },
  "favorites": [{ "id": "…", "name": "닭가슴살 샐러드", "kcal": 420, "createdAt": 0, "updatedAt": 0 }],
  "settings": { "goal": 2000 },
  "meta": { "createdAt": 0, "lastBackupAt": null }
}
```

Firestore 경로:

| 경로 | 내용 |
| --- | --- |
| `users/{uid}/days/{YYYY-MM-DD}` | 하루 기록(식사 배열·몸무게·사진) |
| `users/{uid}/favorites/{id}` | 자주 먹는 음식 |
| `users/{uid}/profile/settings` | 하루 목표 칼로리 |

`firestore.rules` 는 `users/{uid}/**` 를 **본인만** 읽고 쓸 수 있게 하고 나머지 경로는 전부 차단합니다.
Firebase 웹 구성값(apiKey 등)은 원래 공개되어도 되는 식별자이며, 실제 보호는 이 규칙이 담당합니다.

---

## 6. Firebase 연결 절차

1. <https://console.firebase.google.com> → **프로젝트 만들기**
2. **Authentication → 로그인 방법 → Google 사용 설정** (지원 이메일 지정)
3. **Firestore Database → 데이터베이스 만들기** (프로덕션 모드로 시작)
4. **Firestore → 규칙** 탭에 이 폴더의 `firestore.rules` 내용을 붙여넣고 **게시**
5. **프로젝트 설정 → 내 앱 → 웹 앱 추가(`</>`)** → 표시되는 `firebaseConfig` 복사
6. 앱 우측 상단 ⚙️ **설정 → Firebase 구성(JSON)** 에 그대로 붙여넣고 **저장하고 연결**
7. **Google 로그인** → 우측 상단 배지가 `동기화됨` 으로 바뀌면 완료
   - 처음 로그인하면 이 기기의 기록이 Firestore로 올라가고, 다른 기기의 기록은 내려받아 병합합니다.
8. 다른 기기에서는 같은 주소로 접속해 **같은 구성값으로 연결 + 같은 Google 계정 로그인**.

> Google 로그인 팝업이 차단되는 환경(일부 모바일 브라우저)에서는 자동으로 리디렉션 방식으로 전환됩니다.
> Authentication → 설정 → **승인된 도메인**에 배포한 도메인이 등록되어 있어야 로그인이 됩니다(localhost는 기본 허용).

### 동기화 규칙(충돌 처리)
- 각 날짜 문서와 즐겨찾기 항목은 `updatedAt`(ms)을 가집니다.
- 같은 날짜를 두 기기에서 고치면 **더 최근에 저장한 쪽이 남습니다**(last-write-wins).
- 수정·삭제는 0.4초 디바운스 후 업로드되고, 다른 기기의 변경은 `onSnapshot`으로 즉시 반영됩니다.

---

## 7. 프라이버시

- Firebase를 연결하지 않으면 **어떤 데이터도 외부로 나가지 않습니다.** 모든 기록은 이 브라우저의 localStorage에만 있습니다.
- 연결하면 로그인한 본인의 Firestore 영역에만 저장되고, 규칙상 다른 계정은 읽을 수 없습니다.
- 사진은 업로드 전에 기기에서 축소·압축되어 원본이 그대로 올라가지 않습니다.
- 로그아웃해도 이 기기의 로컬 기록은 남습니다. 공용 기기라면 **로컬 기록 모두 지우기**를 사용하세요.
- 브라우저 저장소를 지우면(사이트 데이터 삭제) 로컬 기록도 사라지므로, 주기적으로 **JSON 백업**을 권합니다.

---

## 8. 검증 결과 (2026-11-19)

로컬 HTTP 서버 + headless Chromium(Playwright)으로 실제 UI를 조작하며 확인했습니다.
**52개 항목 전부 통과**, 콘솔 오류 0, 페이지 예외 0.

- 빈 상태 렌더 → 음식 추가 → 요약/게이지 반영
- 사진 첨부 시 Canvas 압축(480px, JPEG, 60KB 이하) 확인
- 즐겨찾기 자동 저장 및 `아/점/저/간` 원터치 추가
- 몸무게 저장·델타 표시, 새로고침 후 유지(localStorage)
- 목표 칼로리 변경(1,400/1,800/2,000) 및 초과 시 앰버 상태
- 삭제, 라이트박스, 달력 42칸·선택일 대비·날짜별 미리보기
- 주간/월간/연간 그래프 렌더, 꼭짓점 수치 라벨 개수, 따로 보기 2패널
- JSON 내보내기(사진 포함)와 다시 불러오기
- 모바일 390×844: 하단 탭 전환, 가로 스크롤 없음, 바텀시트 모달
- 서비스 워커 등록, 매니페스트·512 아이콘 응답
- 테스트 후 localStorage를 비워 **초기 상태로 정리**

검증 스크립트: `handoffs/🍽️-식사-칼로리-체중-일지-웹앱-제작-및-검증/verify.py`
(실행에는 `pip install playwright` 와 Chromium 실행 파일이 필요합니다.)

### 아직 확인하지 못한 것
- **실제 Firebase 프로젝트와의 로그인·동기화**는 자격 증명이 없어 실행해 보지 못했습니다.
  코드 경로(설정 파싱 → 앱 초기화 → 팝업/리디렉션 로그인 → 최초 병합 → 실시간 구독 → 쓰기)는 구현되어 있고,
  잘못된 구성값을 넣었을 때 오류 안내로 거절되는 것까지 확인했습니다.
- 여러 기기 동시 편집 시 충돌은 `updatedAt` 최신 우선 규칙으로만 처리합니다(필드 단위 병합은 하지 않음).

---

## 9. 참고

- 글꼴: Pretendard → Apple SD Gothic Neo → Noto Sans KR → 시스템 폰트 순으로 사용.
- 색: 화이트 `#FFFFFF`/`#F8FAFC`, 딥 네이비 `#0F172A`·`#1E293B`, 세이지 민트 `#10B981`, 앰버 `#F59E0B`.
- 다크 모드는 넣지 않았습니다(요청 사양: 화이트 기반).
