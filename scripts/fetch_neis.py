"""NEIS 교육정보 개방 포털에서 세종시 학교·급식 데이터를 받아 data/ 폴더에 JSON으로 저장한다.

실행:  NEIS_API_KEY=발급키 python3 scripts/fetch_neis.py
  - 인증키는 환경변수로만 받는다. (코드·저장소에 키를 적지 말 것)
  - 대상 학교: config.json 의 "target"
      "all"  → 세종시 초·중·고 전체 (급식 자료가 없는 학교도 목록에 포함)
      "list" → "schools" 에 적은 학교코드만
  - 학년도: config.json 의 schoolYear (예: 2026 → 2026-03-01 ~ 2027-02-28)

NEIS에 없는 '월별 잔반량'과 '선호메뉴'는 학교코드로 고정된 난수를 써서 가상으로 만든다.
(실제 자료가 생기면 data/extra/<학교코드>.json 을 넣으면 그 값을 우선 사용)
"""
import datetime
import hashlib
import json
import os
import pathlib
import random
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CONFIG = ROOT / "config.json"
API = "https://open.neis.go.kr/hub/"
OFFICE = "I10"  # 세종특별자치시교육청

LEVELS = {"초등학교": "초", "중학교": "중", "고등학교": "고"}
# 학교급별 1끼 참고 기준(학교급식 영양관리기준 단순화)
STANDARDS = {
    "초": {"kcal": 640, "protein": 16, "calcium": 267, "iron": 3.5, "vitA": 183, "vitC": 22},
    "중": {"kcal": 840, "protein": 20, "calcium": 300, "iron": 5.0, "vitA": 233, "vitC": 30},
    "고": {"kcal": 900, "protein": 22, "calcium": 267, "iron": 5.0, "vitA": 250, "vitC": 33},
}
NTR_KEYS = {"탄수화물": "carb", "단백질": "protein", "지방": "fat", "비타민A": "vitA", "티아민": "thiamin",
            "리보플라빈": "riboflavin", "비타민C": "vitC", "칼슘": "calcium", "철분": "iron"}


def api(service, **params):
    """NEIS API 호출 (페이지 자동 순회). 자료 없음이면 빈 목록."""
    key = os.environ.get("NEIS_API_KEY", "").strip()
    if not key:
        sys.exit("환경변수 NEIS_API_KEY 가 없습니다.")
    rows, page = [], 1
    while True:
        q = {"KEY": key, "Type": "json", "pIndex": page, "pSize": 1000, "ATPT_OFCDC_SC_CODE": OFFICE, **params}
        url = API + service + "?" + urllib.parse.urlencode(q)
        for attempt in range(4):
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    body = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:  # 네트워크 오류 재시도
                if attempt == 3:
                    raise RuntimeError(f"{service} 호출 실패: {e}") from None
                time.sleep(2 * (attempt + 1))
        if service not in body:
            code = body.get("RESULT", {}).get("CODE", "")
            if code == "INFO-200":  # 해당하는 데이터가 없습니다
                return rows
            raise RuntimeError(f"{service} 오류: {body.get('RESULT')}")
        head, data = body[service][0]["head"], body[service][1]["row"]
        rows += data
        if len(rows) >= head[0]["list_total_count"]:
            return rows
        page += 1
        time.sleep(0.2)


def clean_br(s):
    return [x.strip() for x in re.split(r"<br\s*/?>", s or "") if x.strip()]


def parse_menu(ddish):
    items = []
    for raw in clean_br(ddish):
        allergy = []
        m = re.search(r"\(([\d.\s]+)\)\s*$", raw)
        if m:
            allergy = [int(a) for a in re.findall(r"\d+", m.group(1)) if 1 <= int(a) <= 19]
            raw = raw[: m.start()]
        name = re.sub(r"\s+", " ", raw).strip(" *#&.")
        if name:
            items.append({"name": name, "allergy": allergy})
    return items


def parse_ntr(ntr):
    out = {}
    for line in clean_br(ntr):
        m = re.match(r"([^(:]+)\s*\(.*?\)\s*:\s*([\d.]+)", line)
        if m and m.group(1).strip() in NTR_KEYS:
            out[NTR_KEYS[m.group(1).strip()]] = float(m.group(2))
    return out


def parse_meal(r):
    kcal = re.search(r"[\d.]+", r.get("CAL_INFO") or "")
    return {
        "menu": parse_menu(r.get("DDISH_NM")),
        "kcal": round(float(kcal.group())) if kcal else None,
        "nutrients": parse_ntr(r.get("NTR_INFO")),
        "served": int(r["MLSV_FGR"]) if r.get("MLSV_FGR") else None,
        "origin": clean_br(r.get("ORPLC_INFO")),
    }


def fetch_meals(code, year):
    rows = api("mealServiceDietInfo", SD_SCHUL_CODE=code,
               MLSV_FROM_YMD=f"{year}0301", MLSV_TO_YMD=f"{year + 1}0228")
    meals = {}
    for r in sorted(rows, key=lambda x: (x["MLSV_YMD"], x["MMEAL_SC_CODE"])):
        d = f"{r['MLSV_YMD'][:4]}-{r['MLSV_YMD'][4:6]}-{r['MLSV_YMD'][6:]}"
        meals.setdefault(d, {})[r["MMEAL_SC_NM"]] = parse_meal(r)
    out = {}
    for d, by_type in meals.items():
        main_type = "중식" if "중식" in by_type else next(iter(by_type))
        day = dict(by_type[main_type], type=main_type)
        others = {t: m for t, m in by_type.items() if t != main_type}
        if others:
            day["others"] = others
        out[d] = day
    return out


def dedupe_origin(meals):
    """매일 거의 같은 원산지 문구를 학교별 목록으로 모으고, 날짜에는 번호만 남긴다."""
    table, pos = [], {}
    def ref(m):
        key = "\n".join(m.pop("origin", []))
        if key not in pos:
            pos[key] = len(table)
            table.append(key)
        m["o"] = pos[key]
    for m in meals.values():
        ref(m)
        for o in m.get("others", {}).values():
            ref(o)
    return table


# ---------- 가상 보조 데이터 (NEIS 미제공) ----------
STAPLE = re.compile(r"(밥|김치|깍두기|섞박지|겉절이|피클|무침|나물|쌈장|쌈|김|우유|요거트|요구르트|요플레|주스|국|탕|찌개|개장|스프|수프|물|소스|드레싱|양념장|샐러드)$"
                    r"|자율|수박|사과|키위|귤|바나나|포도|딸기|토마토|오렌지|멜론|참외|자두|복숭아|파인애플|망고|^감$|^배$")


def virtual_extra(code, level, meals):
    rnd = random.Random(int(hashlib.md5(code.encode()).hexdigest()[:8], 16))
    base = {"초": 92, "중": 108, "고": 118}[level] * rnd.uniform(0.82, 1.18)
    season = {1: 1.0, 2: 1.0, 3: 1.08, 4: 1.0, 5: 0.97, 6: 1.04, 7: 1.12, 8: 1.15, 9: 1.06, 10: 0.95, 11: 0.98, 12: 1.02}
    by_month = {}
    for d, m in meals.items():
        by_month.setdefault(d[:7], []).append(m)
    today = datetime.date.today().isoformat()[:7]
    waste = []
    for i, ym in enumerate(sorted(by_month)):
        if ym > today:
            continue
        days = by_month[ym]
        served = sum(m.get("served") or 0 for m in days)
        g = base * season[int(ym[5:])] * rnd.uniform(0.93, 1.07) * (1 - 0.012 * i)
        waste.append({"month": int(ym[5:]), "ym": ym, "servingDays": len(days), "servedTotal": served,
                      "perPersonG": round(g, 1), "totalKg": round(g * served / 1000, 1)})
    # 선호메뉴 후보: 실제 식단에 나온 주찬/부찬 중 자주 나온 메뉴
    freq = {}
    for m in meals.values():
        for it in m["menu"]:
            n = re.split(r"[/&]", re.sub(r"\(.*?\)|\[.*?\]", "", it["name"]))[0].strip(" .")
            if len(n) >= 2 and not STAPLE.search(n):
                freq[n] = freq.get(n, 0) + 1
    cands = sorted((n for n in freq if freq[n] >= 2), key=lambda n: (-freq[n], n))[:30]
    weights = {n: rnd.uniform(0.3, 1.0) + (0.7 if re.search(r"치킨|까스|강정|떡볶이|탕수|불고기|갈비|피자|버거|스파게티|파스타|짜장|자장|카레|마라|핫도그|닭", n) else 0) for n in cands}
    avg_served = round(sum(m.get("served") or 0 for m in meals.values()) / max(len(meals), 1))
    respondents = int(avg_served * rnd.uniform(0.55, 0.8))
    tot = sum(weights.values()) or 1
    top = sorted(weights.items(), key=lambda x: -x[1])[:10]
    prefs = [{"rank": i + 1, "menu": n, "votes": round(w / tot * respondents * 2.2), "share": round(w / tot * 220, 1)}
             for i, (n, w) in enumerate(top)]
    return waste, {"surveyDate": "2026-10-15", "respondents": respondents,
                   "note": "가상 설문 (실제 식단에 나온 메뉴 중 선택, 복수응답)", "top": prefs}


def main():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    year = cfg["schoolYear"]
    info = {r["SD_SCHUL_CODE"]: r for r in api("schoolInfo") if r["SCHUL_KND_SC_NM"] in LEVELS}
    print(f"세종 초·중·고 {len(info)}곳 조회")
    if cfg.get("target", "all") == "all":
        codes = [c for c, _ in sorted(info.items(), key=lambda x: (list(LEVELS).index(x[1]["SCHUL_KND_SC_NM"]), x[1]["SCHUL_NM"].strip()))]
    else:
        codes = [c for c in cfg.get("schools", []) if c in info]
    meals_cache = {}

    (DATA / "meals").mkdir(parents=True, exist_ok=True)
    index = []
    for c in codes:
        r = info[c]
        level = LEVELS[r["SCHUL_KND_SC_NM"]]
        meals = meals_cache.get(c) or fetch_meals(c, year)
        extra_file = DATA / "extra" / f"{c}.json"
        if extra_file.exists():
            extra = json.loads(extra_file.read_text(encoding="utf-8"))
            waste, pref, src = extra["waste"], extra["preference"], "school"
        else:
            (waste, pref), src = virtual_extra(c, level, meals), "virtual"
        m = re.search(r"([가-힣]+(?:동|읍|면))(?![가-힣])", (r.get("ORG_RDNDA") or "")) or \
            re.search(r"([가-힣]+(?:동|읍|면))(?![가-힣])", (r.get("ORG_RDNMA") or "").replace("세종특별자치시", ""))
        dong = m.group(1) if m else ""
        school = {
            "id": c, "name": r["SCHUL_NM"].strip(), "level": level, "dong": dong,
            "address": re.sub(r"\s+", " ", (r.get("ORG_RDNMA") or "")).strip(),
            "found": r.get("FOND_SC_NM"), "coedu": r.get("COEDU_SC_NM"),
            "homepage": r.get("HMPG_ADRES"), "tel": r.get("ORG_TELNO"),
        }
        served = [m["served"] for m in meals.values() if m.get("served")]
        school["avgServed"] = round(sum(served) / len(served)) if served else None
        origins = dedupe_origin(meals)
        data = dict(school, standard=STANDARDS[level], origins=origins, meals=meals, waste=waste, preference=pref, extraSource=src)
        (DATA / "meals" / f"{c}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        avg_waste = sum(w["perPersonG"] for w in waste) / len(waste) if waste else None
        index.append(dict(school, mealDays=len(meals), avgWastePerPersonG=round(avg_waste, 1) if avg_waste else None))
        print(f"  {school['name']}: 급식 {len(meals)}일")
        time.sleep(0.2)

    # 대상에서 빠진 학교 파일 정리
    keep = {f"{c}.json" for c in codes}
    for f in (DATA / "meals").glob("*.json"):
        if f.name not in keep:
            f.unlink()

    kst = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    (DATA / "schools.json").write_text(json.dumps({
        "updated": kst.strftime("%Y-%m-%d %H:%M"), "schoolYear": year,
        "source": "NEIS 교육정보 개방 포털 (학교기본정보, 급식식단정보)",
        "schools": index}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"완료: {len(index)}곳")


if __name__ == "__main__":
    main()
