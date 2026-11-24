# 세종 학교급식 대시보드

세종시 초·중·고 각 20곳(총 60곳)의 2026학년도 급식 정보를 학교별로 조회하는 웹 대시보드입니다.
학교 정보와 식단·열량·영양소는 **NEIS 교육정보 개방 포털** 자료이고, GitHub Actions가 매일 새로 받아옵니다.

| 항목 | 출처 |
|---|---|
| 학교 정보 (주소·설립·남녀공학·홈페이지) | NEIS `schoolInfo` |
| 식단·알레르기·열량·영양소·원산지·급식인원, 조식/중식/석식 | NEIS `mealServiceDietInfo` |
| 월별 잔반량, 선호메뉴 | **가상** (NEIS 미제공) → `data/extra/<학교코드>.json` 넣으면 실제 값으로 대체 |

## 기능
- 학교 검색·선택(초·중·고 그룹), `?school=<학교코드>` 주소로 바로 공유
- 월간 식단 달력, 날짜 클릭 → 조식/중식/석식 탭, 알레르기, 기준 대비 영양소, 원산지
- 일별 열량 추이, 월평균 영양소·에너지 구성비, 월별 잔반량, 선호메뉴 TOP 10
- 같은 학교급 20곳 잔반량 비교(막대 클릭 시 학교 전환), 라이트/다크 테마, 모바일 대응

## 자동 갱신·배포 (GitHub Actions)
`.github/workflows/update-and-deploy.yml`
- 매일 06:17(KST) NEIS 수집 → 바뀐 데이터 커밋 → GitHub Pages 배포
- `main`에 push하면 수집 없이 바로 배포, **Actions → 워크플로 → Run workflow**로 수동 수집도 가능

필요 설정 (최초 1회)
1. **Settings → Secrets and variables → Actions → New repository secret**: `NEIS_API_KEY` = NEIS 인증키
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**

> 인증키는 절대 코드나 JSON 파일에 넣지 마세요. 저장소가 공개되어 있어 누구나 볼 수 있습니다.

## 대상 학교·학년도 바꾸기
`config.json`
```json
{ "schoolYear": 2026, "perLevel": 20, "schools": ["9300212", "..."] }
```
- `schools`: 대상 학교코드 목록(NEIS `SD_SCHUL_CODE`). 비우면 학교급별 이름순으로 급식 자료가 있는 학교를 `perLevel`개씩 자동 선택해 다시 채웁니다.
- `schoolYear`: 학년도(3월 1일 ~ 다음 해 2월 말일).

## 실제 잔반량·선호메뉴 넣기
`data/extra/<학교코드>.json` 파일을 만들면 가상값 대신 사용합니다.
```json
{
  "waste": [{ "month": 3, "ym": "2026-03", "servingDays": 20, "servedTotal": 12880, "perPersonG": 95.2, "totalKg": 1226.2 }],
  "preference": { "surveyDate": "2026-10-15", "respondents": 420, "note": "", "top": [{ "rank": 1, "menu": "치킨까스", "votes": 120, "share": 28.6 }] }
}
```
(이 파일이 있는 학교는 화면의 "가상" 표시가 "학교 자료"로 자동으로 바뀝니다.)

## 로컬 실행
```bash
NEIS_API_KEY=발급받은키 python3 scripts/fetch_neis.py   # 데이터 받기 (선택)
python3 -m http.server 8000                              # http://localhost:8000
```

## 폴더 구조
```
index.html, css/, js/app.js        화면
data/schools.json                  학교 목록·업데이트 시각
data/meals/<학교코드>.json          학교별 식단·영양·잔반·선호도
scripts/fetch_neis.py              NEIS 수집 스크립트
config.json                        대상 학교·학년도
```
