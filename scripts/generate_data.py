"""세종시 가상 학교 10곳의 급식 데이터를 만든다. (모든 값은 가상)
실행: python3 scripts/generate_data.py  → data/ 폴더에 JSON 생성
"""
import json, random, datetime, pathlib

random.seed(2026)
ROOT = pathlib.Path(__file__).resolve().parent.parent / "data"
YEAR = 2026

SCHOOLS = [
    # id, 이름, 학교급, 동, 학생수
    ("s01", "한별초등학교", "초", "한솔동", 812),
    ("s02", "새빛초등학교", "초", "도담동", 1043),
    ("s03", "누리초등학교", "초", "고운동", 958),
    ("s04", "가온초등학교", "초", "조치원읍", 421),
    ("s05", "다솜중학교", "중", "아름동", 735),
    ("s06", "푸른솔중학교", "중", "종촌동", 668),
    ("s07", "해오름중학교", "중", "새롬동", 902),
    ("s08", "미르고등학교", "고", "보람동", 846),
    ("s09", "온누리고등학교", "고", "반곡동", 777),
    ("s10", "나래고등학교", "고", "다정동", 591),
]

# 학교급별 1끼 참고 기준(가상, 학교급식 영양관리기준을 단순화)
STANDARDS = {
    "초": {"kcal": 640, "protein": 16, "calcium": 267, "iron": 3.5, "vitA": 183, "vitC": 22},
    "중": {"kcal": 840, "protein": 20, "calcium": 300, "iron": 5.0, "vitA": 233, "vitC": 30},
    "고": {"kcal": 900, "protein": 22, "calcium": 267, "iron": 5.0, "vitA": 250, "vitC": 33},
}
PORTION = {"초": 0.78, "중": 1.0, "고": 1.08}

# 음식: 이름, kcal, 탄수화물g, 단백질g, 지방g, 칼슘mg, 철mg, 비타민A μgRAE, 비타민C mg, 알레르기번호
F = lambda *a: dict(zip(["name","kcal","carb","protein","fat","calcium","iron","vitA","vitC","allergy"], a))
RICE = [F("백미밥",300,66,5,0.5,5,0.4,0,0,[]), F("현미밥",305,64,6,1.5,8,0.9,0,0,[]),
        F("잡곡밥",310,65,7,1.2,15,1.0,0,0,[]), F("기장밥",305,65,6,1.0,8,0.8,0,0,[]),
        F("흑미밥",305,65,6,1.0,9,0.9,0,0,[]), F("보리밥",300,64,6,0.8,10,0.7,0,0,[])]
ONE_DISH = [F("카레라이스",560,88,14,15,40,2.0,120,8,[2,5,6,10,13]), F("김치볶음밥",540,82,13,16,45,1.8,60,6,[1,5,6,10]),
            F("짜장밥",580,90,15,17,35,2.1,30,4,[5,6,10,13]), F("비빔밥",520,84,16,12,80,3.0,280,10,[1,5,6]),
            F("소불고기덮밥",590,86,24,15,30,3.2,20,5,[5,6,16]), F("돈가스카레",640,92,20,21,45,2.0,90,6,[1,2,5,6,10])]
SOUP = [F("미역국",45,3,4,2,60,1.2,40,1,[5,6,16]), F("된장국",60,6,5,2,70,1.5,40,4,[5,6]),
        F("소고기무국",80,4,7,4,25,1.4,0,6,[5,6,16]), F("어묵국",95,9,6,4,40,0.8,5,2,[1,5,6]),
        F("김치찌개",120,7,9,6,60,1.3,40,8,[5,6,9,10]), F("순두부찌개",110,5,9,6,110,1.7,50,3,[1,5,6]),
        F("콩나물국",30,3,3,1,25,0.5,5,5,[5]), F("감자국",75,13,2,2,15,0.6,0,10,[5,6]),
        F("유부장국",70,4,5,4,60,1.0,5,1,[5,6]), F("닭개장",130,8,12,6,40,1.6,90,6,[5,6,15]),
        F("육개장",125,7,11,6,45,2.0,80,6,[5,6,16]), F("배추된장국",55,6,4,2,80,1.2,60,9,[5,6])]
MAIN = [F("돈육불고기",220,9,17,13,15,1.0,5,2,[5,6,10,13]), F("닭갈비",230,12,20,11,25,1.2,60,8,[5,6,15]),
        F("고등어구이",210,0,20,14,20,1.3,30,0,[7]), F("치킨까스",290,18,15,17,20,0.8,10,1,[1,2,5,6,15]),
        F("떡갈비",250,14,15,15,25,1.6,5,2,[5,6,10,16]), F("제육볶음",240,10,18,14,20,1.1,40,5,[5,6,10]),
        F("삼치데리야끼",200,8,18,10,20,1.0,20,0,[5,6,13]), F("닭강정",310,26,17,15,15,0.9,10,2,[1,2,5,6,15]),
        F("소불고기",230,10,19,12,15,2.2,5,2,[5,6,16]), F("탕수육",320,30,14,16,20,0.9,10,4,[1,5,6,10,13]),
        F("오징어볶음",160,10,17,5,30,0.8,50,6,[5,6,17]), F("훈제오리구이",260,2,17,20,10,2.0,40,0,[]),
        F("함박스테이크",280,15,16,17,35,1.7,15,3,[1,2,5,6,10,12,16]), F("등갈비찜",290,10,19,19,25,1.0,30,4,[5,6,10]),
        F("마파두부",180,8,12,11,140,2.0,30,3,[5,6,10]), F("생선까스",260,18,13,15,25,0.7,15,1,[1,2,5,6])]
SIDE = [F("시금치나물",35,4,2,2,60,1.5,220,12,[5,6]), F("콩나물무침",30,3,3,1,25,0.5,5,4,[5,6]),
        F("멸치볶음",90,8,8,3,320,1.0,10,0,[5,6]), F("계란말이",110,2,8,8,35,1.0,90,0,[1]),
        F("잡채",150,22,4,5,25,0.8,80,3,[5,6,10,16]), F("감자조림",95,18,2,2,8,0.5,0,10,[5,6]),
        F("어묵볶음",110,12,6,4,35,0.7,10,1,[1,5,6]), F("브로콜리숙회",30,4,3,0,40,0.8,60,45,[]),
        F("오이무침",25,4,1,1,15,0.3,10,6,[]), F("두부조림",120,5,9,7,140,1.6,10,1,[5,6]),
        F("메추리알장조림",100,3,8,6,40,1.4,80,0,[1,5,6]), F("떡볶이",190,38,4,2,15,0.6,20,2,[5,6,13]),
        F("양배추샐러드",60,6,1,4,30,0.3,15,25,[1,5,6]), F("애호박볶음",40,5,1,2,15,0.4,30,8,[]),
        F("도라지무침",55,11,1,1,25,0.6,5,4,[5,6]), F("김구이",15,1,1,1,12,0.5,120,2,[])]
KIMCHI = [F("배추김치",20,3,1,0,25,0.3,15,8,[9]), F("깍두기",18,3,1,0,25,0.2,5,10,[9]),
          F("열무김치",15,2,1,0,60,0.6,90,8,[9]), F("총각김치",18,3,1,0,30,0.3,20,9,[9])]
DESSERT = [F("우유",130,10,6,7,220,0.1,55,1,[2]), F("요구르트",90,15,3,2,110,0.1,20,1,[2]),
           F("귤",40,10,1,0,15,0.1,60,24,[]), F("사과",55,14,0,0,4,0.1,2,4,[]),
           F("바나나",80,21,1,0,5,0.3,3,8,[]), F("수박",30,7,1,0,5,0.2,25,6,[]),
           F("방울토마토",20,4,1,0,6,0.2,40,15,[12]), F("요플레",100,15,4,3,120,0.1,25,1,[2]),
           F("식혜",95,22,1,0,5,0.2,0,0,[]), F("초코머핀",210,28,4,9,40,0.8,20,0,[1,2,5,6])]

# 선호메뉴 후보 (설문용)
FAVORITES = ["치킨까스","닭강정","떡볶이","탕수육","돈가스카레","짜장밥","소불고기덮밥","떡갈비",
             "함박스테이크","카레라이스","제육볶음","닭갈비","김치볶음밥","잡채","계란말이","초코머핀",
             "훈제오리구이","마파두부","비빔밥","생선까스"]

MONTHS = list(range(3, 12))  # 3월~11월


def school_days():
    """2026년 3월 3일~11월 30일 평일 중 방학(7/22~8/16)·공휴일 제외"""
    holidays = {(3,2),(5,1),(5,5),(5,25),(6,3),(8,17),(9,24),(9,25),(9,26),(10,5),(10,9)}
    d = datetime.date(YEAR, 3, 3)
    end = datetime.date(YEAR, 11, 30)
    while d <= end:
        if d.weekday() < 5 and (d.month, d.day) not in holidays and not (datetime.date(YEAR,7,22) <= d <= datetime.date(YEAR,8,16)):
            yield d
        d += datetime.timedelta(days=1)


def build_meal(level):
    p = PORTION[level]
    if random.random() < 0.18:      # 일품요리 날
        items = [random.choice(ONE_DISH), random.choice(SOUP), random.choice(SIDE), random.choice(KIMCHI), random.choice(DESSERT)]
    else:
        items = [random.choice(RICE), random.choice(SOUP), random.choice(MAIN),
                 *random.sample(SIDE, 2), random.choice(KIMCHI)]
        if random.random() < 0.6:
            items.append(random.choice(DESSERT))
    nut = {k: 0.0 for k in ["kcal","carb","protein","fat","calcium","iron","vitA","vitC"]}
    for it in items:
        scale = p * random.uniform(0.95, 1.05)
        for k in nut:
            nut[k] += it[k] * scale
    nut = {k: round(v, 1) for k, v in nut.items()}
    return {
        "menu": [{"name": it["name"], "allergy": it["allergy"]} for it in items],
        "kcal": round(nut.pop("kcal")),
        "nutrients": nut,
    }


def main():
    days = list(school_days())
    index = []
    level_waste = {"초": 92, "중": 108, "고": 118}   # 1인 1끼 기본 잔반 g
    season = {3:1.08,4:1.0,5:0.97,6:1.04,7:1.12,8:1.15,9:1.06,10:0.95,11:0.98}
    for sid, name, level, dong, students in SCHOOLS:
        school_factor = random.uniform(0.82, 1.18)
        meals = {}
        for d in days:
            meals[d.isoformat()] = build_meal(level)
        # 월별 잔반량
        waste = []
        for m in MONTHS:
            served = sum(1 for d in days if d.month == m)
            per_person = level_waste[level] * school_factor * season[m] * random.uniform(0.93, 1.07)
            per_person *= (1 - 0.012 * (m - 3))   # 잔반 줄이기 캠페인 효과(가상)
            total_kg = per_person * students * served / 1000
            waste.append({"month": m, "servingDays": served, "perPersonG": round(per_person, 1), "totalKg": round(total_kg, 1)})
        # 선호메뉴 설문
        weights = {f: random.uniform(0.3, 1.0) for f in FAVORITES}
        for f in ["치킨까스", "닭강정", "떡볶이", "탕수육"]:
            weights[f] += 0.5 if level != "고" else 0.3
        if level == "고":
            for f in ["제육볶음", "훈제오리구이", "닭갈비"]:
                weights[f] += 0.4
        respondents = int(students * random.uniform(0.55, 0.8))
        tot = sum(weights.values())
        ranked = sorted(weights.items(), key=lambda x: -x[1])[:10]
        prefs = [{"rank": i + 1, "menu": n, "votes": round(w / tot * respondents * 2.2), "share": round(w / tot * 100 * 2.2, 1)}
                 for i, (n, w) in enumerate(ranked)]
        data = {
            "id": sid, "name": name, "level": level, "dong": dong, "students": students,
            "standard": STANDARDS[level], "meals": meals, "waste": waste,
            "preference": {"surveyDate": "2026-10-15", "respondents": respondents,
                           "note": "1인 최대 3개 복수응답 (가상 설문)", "top": prefs},
        }
        (ROOT / "meals" / f"{sid}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        avg_waste = sum(w["perPersonG"] for w in waste) / len(waste)
        index.append({"id": sid, "name": name, "level": level, "dong": dong, "students": students,
                      "avgWastePerPersonG": round(avg_waste, 1)})
    (ROOT / "schools.json").write_text(json.dumps({"generated": "2026-11-24", "notice": "모든 데이터는 가상입니다.",
                                                   "schools": index}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(index)}개 학교, 급식일 {len(days)}일 생성 완료")


if __name__ == "__main__":
    main()
