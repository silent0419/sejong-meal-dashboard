/* 세종 학교급식 대시보드 – 정적 사이트(GitHub Pages)용
 * 데이터: data/schools.json, data/meals/<학교코드>.json  (scripts/fetch_neis.py 가 NEIS에서 생성) */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const LEVEL_NAME = { "초": "초등학교", "중": "중학교", "고": "고등학교" };
  const NUT = [
    { key: "protein", name: "단백질", unit: "g" },
    { key: "calcium", name: "칼슘", unit: "mg" },
    { key: "iron", name: "철분", unit: "mg" },
    { key: "vitA", name: "비타민A", unit: "R.E" },
    { key: "vitC", name: "비타민C", unit: "mg" },
  ];
  const ALLERGY = ["", "난류", "우유", "메밀", "땅콩", "대두", "밀", "고등어", "게", "새우", "돼지고기",
    "복숭아", "토마토", "아황산류", "호두", "닭고기", "쇠고기", "오징어", "조개류", "잣"];
  const MEAL_ORDER = ["조식", "중식", "석식"];

  const state = { level: "", index: null, schools: [], school: null, month: null, day: null, mealType: null, cache: {}, charts: {} };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const fmt = (n, d = 0) => (n == null || isNaN(n)) ? "-" :
    Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: d });
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const todayISO = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); })();
  const xBadge = () => state.school?.extraSource === "school" ? `<span class="src neis">학교 자료</span>` : `<span class="src virtual">가상</span>`;
  const shortName = (n) => n.replace(/초등학교$/, "초").replace(/중학교$/, "중").replace(/고등학교$/, "고");

  async function loadJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(url + " 불러오기 실패 (" + r.status + ")");
    return r.json();
  }

  /* ---------- 학교 선택 ---------- */
  function fillSchoolSelect(keyword = "") {
    const sel = $("#schoolSel"), cur = sel.value || state.school?.id;
    const kw = keyword.trim().replace(/\s+/g, "");
    const match = (s) => !kw || (s.name + s.dong + LEVEL_NAME[s.level] + s.address).replace(/\s+/g, "").includes(kw);
    sel.innerHTML = "";
    let n = 0;
    ["초", "중", "고"].forEach((lv) => {
      if (state.level && lv !== state.level) return;
      const list = state.schools.filter((s) => s.level === lv && match(s));
      if (!list.length) return;
      const g = document.createElement("optgroup");
      g.label = `${LEVEL_NAME[lv]} (${list.length})`;
      list.forEach((s) => g.append(new Option(`${s.name}${s.dong ? ` (${s.dong})` : ""}`, s.id)));
      sel.append(g); n += list.length;
    });
    $("#schoolCount").textContent = kw ? `검색 ${n}곳` : `${n}곳`;
    document.querySelectorAll("#levelSeg button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.lv === state.level)));
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
    return n;
  }

  async function init() {
    state.index = await loadJSON("data/schools.json");
    state.schools = state.index.schools;
    $("#sourceLine").innerHTML = `<span class="meta m-hide">세종특별자치시 <b>초·중·고 ${state.schools.length}곳</b></span>
      <span class="meta">📅 <b>${state.index.schoolYear}학년도</b></span>
      <span class="meta m-hide">출처 <span class="tag neis">NEIS</span> 교육정보 개방 포털</span>
      <span class="meta">🔄 업데이트 <b>${esc(state.index.updated)}</b></span>`;
    updateThemeBtn();
    fillSchoolSelect();
    const sel = $("#schoolSel");
    sel.addEventListener("change", () => selectSchool(sel.value));
    $("#schoolSearch").addEventListener("input", (e) => {
      const n = fillSchoolSelect(e.target.value);
      if (n && sel.value !== state.school?.id) selectSchool(sel.value);
    });
    document.querySelectorAll("#levelSeg button").forEach((b) => b.addEventListener("click", () => {
      state.level = b.dataset.lv;
      store.set("level", state.level);
      const n = fillSchoolSelect($("#schoolSearch").value);
      if (n && sel.value !== state.school?.id) selectSchool(sel.value);
    }));
    $("#monthSel").addEventListener("change", (e) => { state.month = e.target.value; state.day = null; renderMonth(); });
    $("#themeBtn").addEventListener("click", toggleTheme);
    let wasNarrow = window.innerWidth < 600;
    window.addEventListener("resize", () => {
      const n = window.innerWidth < 600;
      if (n !== wasNarrow && state.school) { wasNarrow = n; renderCompare(); }
    });

    const urlId = new URLSearchParams(location.search).get("school");
    const startId = [urlId, store.get("school")].find((id) => state.schools.some((s) => s.id === id)) || state.schools[0].id;
    const savedLv = store.get("level") || "";
    const startLv = state.schools.find((s) => s.id === startId).level;
    state.level = savedLv && savedLv !== startLv ? startLv : savedLv;
    fillSchoolSelect();
    sel.value = startId;
    await selectSchool(startId);
  }

  async function selectSchool(id) {
    if (!state.cache[id]) state.cache[id] = await loadJSON(`data/meals/${id}.json`);
    state.school = state.cache[id];
    if (state.level && state.level !== state.school.level) state.level = state.school.level;
    if ($("#schoolSel").value !== id) { $("#schoolSearch").value = ""; fillSchoolSelect(); $("#schoolSel").value = id; }
    store.set("school", id);
    const url = new URL(location.href); url.searchParams.set("school", id); history.replaceState(null, "", url);

    const months = [...new Set(Object.keys(state.school.meals).map((d) => d.slice(0, 7)))].sort();
    const hasData = months.length > 0;
    $("#noData").hidden = hasData;
    $("#dataArea").hidden = !hasData;
    const ms = $("#monthSel");
    ms.innerHTML = "";
    months.forEach((m) => ms.append(new Option(`${m.slice(0, 4)}년 ${+m.slice(5)}월`, m)));
    const thisMonth = todayISO.slice(0, 7);
    state.month = months.includes(state.month) ? state.month
      : months.includes(thisMonth) ? thisMonth : months.filter((m) => m <= thisMonth).pop() || months[0];
    ms.value = state.month;
    state.day = null;

    const s = state.school;
    const homeUrl = s.homepage ? (/^https?:\/\//i.test(s.homepage) ? s.homepage : "http://" + s.homepage) : "";
    const chips = [
      `📍 ${esc(s.address)}`,
      s.found && `🏫 ${esc(s.found)}`,
      s.coedu && `👥 ${esc(s.coedu)}`,
      s.avgServed && `🍚 하루 평균 급식 <b>${fmt(s.avgServed)}명</b>`,
    ].filter(Boolean).map((c) => `<span class="chip">${c}</span>`).join("");
    $("#schoolInfo").innerHTML = `
      <div>
        <div class="hero-title"><span class="lv-chip">${LEVEL_NAME[s.level]}</span><h2>${esc(s.name)}</h2></div>
        <div class="chips">${chips}</div>
      </div>
      <div class="hero-actions">
        ${homeUrl ? `<a class="btn primary" href="${esc(homeUrl)}" target="_blank" rel="noopener">🏠 학교 홈페이지 <span aria-hidden="true">↗</span></a>` : ""}
        ${s.tel ? `<a class="btn outline" href="tel:${esc(s.tel.replace(/[^0-9]/g, ""))}">📞 ${esc(s.tel)}</a>` : ""}
      </div>`;
    document.querySelectorAll(".xsrc").forEach((el) => { el.outerHTML = xBadge().replace('class="src', 'class="xsrc src'); });
    if (!hasData) { $("#monthSel").innerHTML = "<option>자료 없음</option>"; return; }
    renderMonth();
    renderPrefs();
    renderCompare();
  }

  const monthDays = () => Object.keys(state.school.meals).filter((d) => d.startsWith(state.month)).sort();

  function renderMonth() {
    const days = monthDays();
    if (!days.length) return;
    if (!state.day || !days.includes(state.day)) {
      state.day = days.includes(todayISO) ? todayISO : (days.filter((d) => d <= todayISO).pop() || days[0]);
    }
    state.mealType = null;
    renderKpis(days);
    renderCalendar(days);
    renderDay();
    renderKcal(days);
    renderMonthNut(days);
    renderWaste();
  }

  function renderKpis(days) {
    const s = state.school, meals = days.map((d) => s.meals[d]).filter((m) => m.kcal);
    const mo = +state.month.slice(5);
    const avgKcal = meals.reduce((a, m) => a + m.kcal, 0) / (meals.length || 1);
    const wi = s.waste.findIndex((w) => w.ym === state.month);
    const w = s.waste[wi], pw = wi > 0 ? s.waste[wi - 1] : null;
    let wasteHtml;
    if (w) {
      let delta = "전월 자료 없음", cls = "";
      if (pw) {
        const d = ((w.perPersonG - pw.perPersonG) / pw.perPersonG) * 100;
        cls = d <= 0 ? "good" : "bad";
        delta = `${d <= 0 ? "▼" : "▲"} 전월 대비 ${fmt(Math.abs(d), 1)}% ${d <= 0 ? "감소" : "증가"}`;
      }
      wasteHtml = `<div class="kpi"><div class="label">${mo}월 1인 1끼 잔반 ${xBadge()}</div>
          <div class="value">${fmt(w.perPersonG, 1)}<small>g</small></div><div class="delta ${cls}">${delta}</div></div>
        <div class="kpi"><div class="label">${mo}월 잔반 총량 ${xBadge()}</div>
          <div class="value">${fmt(w.totalKg / 1000, 2)}<small>톤</small></div>
          <div class="delta">급식 ${w.servingDays}일 · 연인원 ${fmt(w.servedTotal)}명</div></div>`;
    } else {
      wasteHtml = `<div class="kpi"><div class="label">${mo}월 잔반</div><div class="value">-</div><div class="delta">아직 집계 전인 달입니다</div></div>
        <div class="kpi"><div class="label">${mo}월 급식일</div><div class="value">${days.length}<small>일</small></div><div class="delta">예정 식단 포함</div></div>`;
    }
    const top = s.preference.top[0];
    $("#kpis").innerHTML = `
      <div class="kpi"><div class="label">${mo}월 평균 열량 <span class="src neis">NEIS</span></div>
        <div class="value">${fmt(avgKcal)}<small>kcal</small></div>
        <div class="delta">기준 ${fmt(s.standard.kcal)}kcal의 ${fmt(avgKcal / s.standard.kcal * 100)}% · ${meals.length}일</div></div>
      ${wasteHtml}
      <div class="kpi"><div class="label">선호메뉴 1위 ${xBadge()}</div>
        <div class="value" style="font-size:1.3rem">${esc(top ? top.menu : "-")}</div>
        <div class="delta">${top ? `${fmt(top.votes)}표 · 응답자의 ${fmt(top.share, 1)}%` : ""}</div></div>`;
  }

  function renderCalendar(days) {
    const cal = $("#calendar");
    cal.innerHTML = "";
    const y = +state.month.slice(0, 4), m = +state.month.slice(5);
    const last = new Date(y, m, 0).getDate();
    let first = true;
    for (let d = 1; d <= last; d++) {
      const wd = new Date(y, m - 1, d).getDay();
      if (wd === 0 || wd === 6) continue;
      if (first) { for (let i = 1; i < wd; i++) cal.append(Object.assign(document.createElement("div"), { className: "day blank" })); first = false; }
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const meal = state.school.meals[iso];
      const el = document.createElement(meal ? "button" : "div");
      el.className = "day" + (meal ? "" : " empty") + (iso === state.day ? " sel" : "");
      if (meal) {
        el.type = "button";
        el.innerHTML = `<div class="d"><span>${d}</span><span class="k">${meal.kcal ?? ""}</span></div>
          <div class="m">${meal.menu.map((x) => esc(x.name)).join(" · ")}</div>`;
        el.setAttribute("aria-label", `${m}월 ${d}일 식단${meal.kcal ? `, ${meal.kcal}킬로칼로리` : ""}`);
        el.addEventListener("click", () => { state.day = iso; state.mealType = null; renderCalendar(days); renderDay(); });
      } else {
        el.innerHTML = `<div class="d"><span>${d}</span></div><div class="m">급식 없음</div>`;
      }
      cal.append(el);
    }
  }

  function nutRow(name, val, std, unit) {
    if (val == null) return `<div class="nut-row"><span class="name">${name}</span><span class="track"></span><span class="num muted">자료 없음</span></div>`;
    const pct = (val / std) * 100, w = Math.min(pct, 150) / 150 * 100;
    return `<div class="nut-row" title="${name} ${fmt(val, 1)}${unit} / 기준 ${fmt(std, 1)}${unit}">
      <span class="name">${name}</span>
      <span class="track"><span class="fill" style="width:${w}%"></span><span class="mark100" style="left:${100 / 1.5}%"></span></span>
      <span class="num"><span class="${pct < 80 ? "low" : ""}">${fmt(pct)}%</span> <span class="muted">${fmt(val, unit === "kcal" ? 0 : 1)}${unit}</span></span></div>`;
  }

  function renderDay() {
    const s = state.school, day = s.meals[state.day];
    const all = { [day.type]: day, ...(day.others || {}) };
    const types = MEAL_ORDER.filter((t) => all[t]);
    if (!state.mealType || !all[state.mealType]) state.mealType = day.type;
    const meal = all[state.mealType];

    const dt = new Date(state.day + "T00:00:00");
    $("#dayTitle").textContent = `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${"일월화수목금토"[dt.getDay()]}) 식단`;
    $("#dayKcal").textContent = meal.kcal ? `${fmt(meal.kcal)} kcal · 기준의 ${fmt(meal.kcal / s.standard.kcal * 100)}%${meal.served ? ` · ${fmt(meal.served)}명` : ""}` : "";
    const tabs = $("#mealTabs");
    tabs.innerHTML = types.length > 1 ? types.map((t) =>
      `<button type="button" role="tab" aria-selected="${t === state.mealType}" data-t="${t}">${t}</button>`).join("") : "";
    tabs.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { state.mealType = b.dataset.t; renderDay(); }));

    $("#dayMenu").innerHTML = meal.menu.map((x) =>
      `<li data-alg="${x.allergy.join(" ")}">${esc(x.name)}${x.allergy.length ? `<span class="alg" title="${x.allergy.map((a) => ALLERGY[a]).join(", ")}">${x.allergy.join("·")}</span>` : ""}</li>`).join("");
    const n = meal.nutrients || {};
    $("#dayNut").innerHTML = [nutRow("열량", meal.kcal, s.standard.kcal, "kcal"),
      ...NUT.map((x) => nutRow(x.name, n[x.key], s.standard[x.key], x.unit))].join("");
    const used = [...new Set(meal.menu.flatMap((x) => x.allergy))].sort((a, b) => a - b);
    renderAllergy(used);
    renderOrigin(s.origins?.[meal.o] || "");
  }

  function renderAllergy(used) {
    const box = $("#allergyBox");
    if (!used.length) { box.innerHTML = `<div class="allergy-h">✅ 알레르기 유발식품</div><div class="allergy-none">이 식단에는 표시된 알레르기 유발식품이 없습니다.</div>`; return; }
    box.innerHTML = `<div class="allergy-h">⚠️ 알레르기 유발식품 <span class="muted">${used.length}종</span></div>
      <div class="alg-chips">${used.map((a) => `<button type="button" class="alg-chip" data-a="${a}"><b>${a}</b>${ALLERGY[a]}</button>`).join("")}</div>
      <div class="allergy-tip">항목에 마우스를 올리거나 누르면 해당 메뉴가 표시됩니다.</div>`;
    const items = [...document.querySelectorAll("#dayMenu li")];
    const mark = (a) => {
      box.querySelectorAll(".alg-chip").forEach((c) => c.classList.toggle("on", c.dataset.a === a));
      items.forEach((li) => li.classList.toggle("hit", !!a && li.dataset.alg.split(" ").includes(a)));
    };
    box.querySelectorAll(".alg-chip").forEach((c) => {
      c.addEventListener("mouseenter", () => mark(c.dataset.a));
      c.addEventListener("mouseleave", () => mark(null));
      c.addEventListener("focus", () => mark(c.dataset.a));
      c.addEventListener("blur", () => mark(null));
      c.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") mark(c.classList.contains("on") ? null : c.dataset.a); });
    });
  }

  const SKIP_ORIGIN = /^(미사용|제공시 표기|해당없음|-)?$/;
  const IMPORTED = /외국|수입|러시아|원양|베트남|중국|페루|호주|미국|칠레|노르웨이|인도네시아|필리핀|태국|뉴질랜드|캐나다|스페인|덴마크|브라질|아르헨티나|태평양|대서양/;
  function renderOrigin(text) {
    const rows = text.split("\n").map((l) => {
      const i = l.indexOf(":");
      return i < 0 ? null : { item: l.slice(0, i).trim(), from: l.slice(i + 1).trim() };
    }).filter((r) => r && r.item && !SKIP_ORIGIN.test(r.from) && r.item !== "비고");
    $("#originBox").hidden = !rows.length;
    if (!rows.length) return;
    const imp = rows.filter((r) => IMPORTED.test(r.from));
    $("#originText").innerHTML = `<div class="origin-sum"><span>표시 품목 <b>${rows.length}</b>개</span>
        <span>국내산 <b>${rows.length - imp.length}</b>개</span><span>수입·원양 포함 <b>${imp.length}</b>개</span></div>
      <div class="origin-grid">${rows.map((r) => `<div class="og${IMPORTED.test(r.from) ? " imp" : ""}" title="${esc(r.item)} : ${esc(r.from)}">
        <span class="item">${esc(r.item)}</span><span class="from">${esc(r.from)}</span></div>`).join("")}</div>`;
  }

  /* ---------- Chart.js 공통 ---------- */
  function baseOpts() {
    const muted = css("--muted");
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: css("--surface"), titleColor: css("--text"), bodyColor: css("--text"),
          borderColor: css("--axis"), borderWidth: 1, padding: 10, displayColors: false },
      },
      scales: {
        x: { grid: { display: false }, border: { color: css("--axis") }, ticks: { color: muted, font: { size: 11 } } },
        y: { grid: { color: css("--grid") }, border: { display: false }, ticks: { color: muted, font: { size: 11 } }, beginAtZero: true },
      },
    };
  }
  function draw(id, config) {
    if (state.charts[id]) state.charts[id].destroy();
    state.charts[id] = new Chart(document.getElementById(id), config);
  }
  const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  function renderKcal(allDays) {
    const s = state.school, std = s.standard.kcal;
    const days = allDays.filter((d) => s.meals[d].kcal);
    const labels = days.map((d) => `${+d.slice(8)}일`);
    const vals = days.map((d) => s.meals[d].kcal);
    $("#kcalSub").textContent = `중식 기준 · 점선 = 기준 ${fmt(std)}kcal`;
    const opts = baseOpts();
    const lo = Math.min(std, ...vals), hi = Math.max(std, ...vals);
    opts.scales.y.beginAtZero = false;
    opts.scales.y.suggestedMin = Math.floor(lo * 0.9 / 50) * 50;
    opts.scales.y.suggestedMax = Math.ceil(hi * 1.05 / 50) * 50;
    opts.plugins.tooltip.callbacks = {
      label: (c) => c.datasetIndex === 0 ? `열량 ${fmt(c.raw)} kcal` : `기준 ${fmt(c.raw)} kcal`,
      afterBody: (items) => s.meals[days[items[0].dataIndex]].menu.map((x) => x.name).join(", "),
    };
    opts.onClick = (_, el) => { if (el.length) { state.day = days[el[0].index]; state.mealType = null; renderCalendar(allDays); renderDay(); } };
    draw("kcalChart", {
      type: "line",
      data: { labels, datasets: [
        { data: vals, borderColor: css("--s1"), backgroundColor: css("--s1"), borderWidth: 2, pointRadius: 3,
          pointHoverRadius: 6, pointBorderColor: css("--surface"), pointBorderWidth: 2, tension: 0.25 },
        { data: labels.map(() => std), borderColor: css("--muted"), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 0 },
      ] },
      options: opts,
    });
    $("#kcalTable").innerHTML = table(["날짜", "열량(kcal)", "기준 대비", "급식인원"],
      days.map((d) => { const m = s.meals[d]; return [d.slice(5).replace("-", "/"), fmt(m.kcal), fmt(m.kcal / std * 100) + "%", fmt(m.served)]; }));
  }

  function renderMonthNut(days) {
    const s = state.school, meals = days.map((d) => s.meals[d]).filter((m) => m.kcal);
    const avg = (f) => { const v = meals.map(f).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    $("#monthNut").innerHTML = [nutRow("열량", avg((m) => m.kcal), s.standard.kcal, "kcal"),
      ...NUT.map((n) => nutRow(n.name, avg((m) => m.nutrients?.[n.key]), s.standard[n.key], n.unit))].join("");
    const c = avg((m) => m.nutrients?.carb) * 4, p = avg((m) => m.nutrients?.protein) * 4, f = avg((m) => m.nutrients?.fat) * 9;
    const t = c + p + f;
    if (!t) { $("#energyMix").innerHTML = `<p class="muted">자료 없음</p>`; return; }
    const parts = [["탄수화물", c / t * 100, "--s1", "권장 55~65%"], ["단백질", p / t * 100, "--s2", "권장 7~20%"], ["지방", f / t * 100, "--s3", "권장 15~30%"]];
    $("#energyMix").innerHTML = `<div class="mix-bar" role="img" aria-label="${parts.map((x) => `${x[0]} ${fmt(x[1])}%`).join(", ")}">${
      parts.map((x) => `<span style="width:${x[1]}%;background:var(${x[2]})" title="${x[0]} ${fmt(x[1], 1)}%"></span>`).join("")}</div>
      <div class="legend">${parts.map((x) => `<span><i style="background:var(${x[2]})"></i>${x[0]} <strong>${fmt(x[1], 1)}%</strong> <span class="muted">(${x[3]})</span></span>`).join("")}</div>`;
  }

  function renderWaste() {
    const s = state.school;
    const opts = baseOpts();
    opts.plugins.tooltip.callbacks = {
      label: (c) => `1인 1끼 ${fmt(c.raw, 1)} g`,
      afterLabel: (c) => { const w = s.waste[c.dataIndex]; return `총 ${fmt(w.totalKg)} kg · 급식 ${w.servingDays}일`; },
    };
    opts.scales.y.title = { display: true, text: "g", color: css("--muted") };
    draw("wasteChart", {
      type: "bar",
      data: { labels: s.waste.map((w) => `${w.month}월`), datasets: [{
        data: s.waste.map((w) => w.perPersonG),
        backgroundColor: s.waste.map((w) => w.ym === state.month ? css("--s1") : css("--other")),
        hoverBackgroundColor: css("--s1"),
        borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 34 }] },
      options: opts,
    });
    $("#wasteTable").innerHTML = table(["월", "급식일", "연인원", "1인 1끼(g)", "총량(kg)"],
      s.waste.map((w) => [`${w.month}월`, w.servingDays, fmt(w.servedTotal), fmt(w.perPersonG, 1), fmt(w.totalKg, 1)]));
  }

  function renderPrefs() {
    const pr = state.school.preference, max = pr.top[0]?.votes || 1;
    $("#prefSub").textContent = `${pr.surveyDate} 설문 · 응답 ${fmt(pr.respondents)}명 · 복수응답`;
    const row = (t) => `<li title="${esc(t.menu)}: ${fmt(t.votes)}표 (${fmt(t.share, 1)}%)">
      <span class="rk">${t.rank}</span><span class="pm">${esc(t.menu)}</span>
      <span class="track"><span class="fill" style="width:${t.votes / max * 100}%"></span></span>
      <span class="num">${fmt(t.votes)}표</span></li>`;
    $("#prefList").innerHTML = pr.top.slice(0, 5).map(row).join("");
    $("#prefList2").innerHTML = pr.top.slice(5, 10).map(row).join("");
    $(".pref-sep").hidden = pr.top.length <= 5;
  }

  function renderCompare() {
    const me = state.school, lv = me.level;
    const meIdx = state.schools.find((s) => s.id === me.id);
    // 같은 학교급에서 하루 평균 급식인원이 가장 가까운 10곳 + 선택 학교
    const peers = state.schools.filter((s) => s.level === lv && s.id !== me.id && s.avgWastePerPersonG != null && s.avgServed)
      .sort((a, b) => Math.abs(a.avgServed - me.avgServed) - Math.abs(b.avgServed - me.avgServed)).slice(0, 10);
    const list = [meIdx, ...peers].filter((s) => s && s.avgWastePerPersonG != null)
      .sort((a, b) => a.avgWastePerPersonG - b.avgWastePerPersonG);
    const served = peers.map((s) => s.avgServed);
    $("#compareTitle").textContent = `규모가 비슷한 ${LEVEL_NAME[lv]} ${peers.length}곳과 잔반량 비교`;
    $("#compareSub").textContent = served.length ? `기준: 하루 평균 급식인원 (이 학교 ${fmt(me.avgServed)}명 · 비교 학교 ${fmt(Math.min(...served))}~${fmt(Math.max(...served))}명) · 학년도 누적 1인 1끼 평균 (g)` : "";
    const rank = list.findIndex((s) => s.id === me.id) + 1;
    $("#compareSub").textContent += ` · ${list.length}곳 중 잔반 적은 순 ${rank}위`;
    const opts = baseOpts();
    const narrow = window.innerWidth < 600;   // 모바일: 가로 막대로 표시
    document.getElementById("compareChart").parentElement.classList.toggle("horizontal", narrow);
    if (narrow) {
      opts.indexAxis = "y";
      opts.scales = { x: opts.scales.y, y: opts.scales.x };
      opts.scales.y.ticks.autoSkip = false;
      opts.scales.y.ticks.font = { size: 11 };
    } else {
      opts.scales.x.ticks.autoSkip = false;
      opts.scales.x.ticks.maxRotation = 45;
    }
    opts.plugins.tooltip.callbacks = {
      title: (i) => list[i[0].dataIndex].name,
      label: (c) => `1인 1끼 평균 잔반 ${fmt(c.raw, 1)} g`,
      afterLabel: (c) => `하루 평균 급식 ${fmt(list[c.dataIndex].avgServed)}명`,
    };
    opts.onClick = (_, el) => { if (el.length) selectSchool(list[el[0].index].id); };
    opts.onHover = (e, el) => { e.native.target.style.cursor = el.length ? "pointer" : "default"; };
    draw("compareChart", {
      type: "bar",
      data: { labels: list.map((s) => narrow ? `${shortName(s.name)} (${fmt(s.avgServed)}명)` : [shortName(s.name), `${fmt(s.avgServed)}명`]),
        datasets: [{ data: list.map((s) => s.avgWastePerPersonG),
          backgroundColor: list.map((s) => s.id === state.school.id ? css("--s1") : css("--other")),
          hoverBackgroundColor: css("--s1"),
          borderRadius: narrow ? { topRight: 4, bottomRight: 4 } : { topLeft: 4, topRight: 4 },
          borderSkipped: narrow ? "left" : "bottom", maxBarThickness: 48 }] },
      options: opts,
    });
  }

  function toggleTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("theme", root.dataset.theme);
    updateThemeBtn();
    renderMonth(); renderCompare();
  }

  function updateThemeBtn() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    $("#themeIcon").textContent = dark ? "☀️" : "🌙";
    $("#themeLabel").textContent = dark ? "라이트 모드" : "다크 모드";
  }

  init().catch((e) => {
    document.querySelector("main").insertAdjacentHTML("afterbegin",
      `<p class="card" style="margin-top:16px">데이터를 불러오지 못했습니다: ${esc(e.message)}<br>
      로컬에서 열 때는 <code>python3 -m http.server</code>로 서버를 실행한 뒤 접속하세요.</p>`);
  });
})();
