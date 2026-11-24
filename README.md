# 세종 학교급식 대시보드 (가상 데이터)

세종시 학교 10곳의 급식 데이터(식단·영양소·칼로리·월별 잔반량·선호메뉴)를 학교별로 조회하는 정적 웹 대시보드입니다.
**모든 학교명과 수치는 시연용 가상 데이터**입니다.

## 기능
- 학교 선택(초 4 · 중 3 · 고 3) → 해당 학교 데이터 표시, `?school=s05` 주소로 바로 공유 가능
- 월 선택(2026년 3~11월) · 월간 식단 달력 · 날짜 클릭 시 일일 식단/알레르기/영양소 상세
- 일별 열량 추이(학교급별 기준선), 월평균 영양소 기준 대비 %, 에너지 구성비
- 월별 1인 1끼 잔반량, 선호메뉴 TOP 10, 10개 학교 잔반량 비교(막대 클릭 시 학교 전환)
- 라이트/다크 테마, 모바일 화면 대응, "표로 보기"

## 폴더 구조
```
index.html            화면
css/style.css         스타일
js/app.js             데이터 로드·차트(Chart.js)
data/schools.json     학교 목록
data/meals/sXX.json   학교별 식단·영양·잔반·선호도
scripts/generate_data.py  가상 데이터 생성기
```

## 로컬 실행
`fetch`로 JSON을 읽기 때문에 파일을 더블클릭하지 말고 간단한 서버로 여세요.
```bash
python3 -m http.server 8000
```
→ 브라우저에서 http://localhost:8000

## GitHub Pages 배포
1. GitHub에서 새 저장소 생성 (예: `sejong-meal-dashboard`, Public)
2. 이 폴더를 push
3. 저장소 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**
4. 1~2분 후 `https://<GitHub아이디>.github.io/sejong-meal-dashboard/` 접속

## 데이터 교체
- 가상 데이터 다시 만들기: `python3 scripts/generate_data.py`
- 실제 데이터로 바꿀 때는 `data/meals/sXX.json` 형식을 유지하면 화면 코드는 수정할 필요가 없습니다.
  (예: NEIS 교육정보 개방 포털 급식식단정보 API 결과를 같은 형식으로 변환)
