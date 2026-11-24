/* 세종 학교급식 대시보드 – 정적 사이트(GitHub Pages)용 */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const LEVEL_NAME = { "초": "초등학교", "중": "중학교", "고": "고등학교" };
  const NUT = [
    { key: "protein", name: "단백질", unit: "g" },
    { key: "calcium", name: "칼슘", unit: "mg" },
    { key: "iron", name: "철분", unit: "mg" },
    { key: "vitA", name: "비타민A", unit: "μgRAE" },
    { key: "vitC", name: "비타민C", unit: "mg" },
  ];
  const ALLERGY = ["", "난류", "우유", "메밀", "땅콩", "대두", "밀", "고등어", "게", "새우", "돼지고기",
    "복숭아", "토마토", "아황산류", "호두", "닭고기", "쇠고기", "오징어", "조개류", "잣"];

  const state = { schools: [], school: null, month: null, day: null, cache: {}, charts: {} };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const fmt = (n, d = 0) => Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: d });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  async function loadJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + " 불러오기 실패 (" + r.status + ")");
    return r.json();
  }

  async function init() {
    const idx = await loadJSON("data/schools.json");
    state.schools = idx.schools;
    const sel = $("#schoolSel");
    ["초", "중", "고"].forEach((lv) => {
      const g = document.createElement("optgroup");
      g.label = LEVEL_NAME[lv];
      idx.schools.filter((s) => s.level === lv).forEach((s) => g.append(new Option(`${s.name} (${s.dong})`, s.id)));
      sel.append(g);
    });
    const urlId = new URLSearchParams(location.search).get("school");
    const startId = [urlId, store.get("school")].find((id) => idx.schools.some((s) => s.id === id)) || idx.schools[0].id;
    sel.value = startId;
    sel.addEventListener("change", () => selectSchool(sel.value));
    $("#monthSel").addEventListener("change", (e) => { state.month = +e.target.value; state.day = null; renderMonth(); });
    $("#themeBtn").addEventListener("click", toggleTheme);
    await selectSchool(startId);
  }

  async function selectSchool(id) {
    if (!state.cache[id]) state.cache[id] = await loadJSON(`data/meals/${id}.json`);
    state.school = state.cache[id];
    store.set("school", id);
    const url = new URL(location.href); url.searchParams.set("school", id); history.replaceState(null, "", url);

    const months = [...new Set(Object.keys(state.school.meals).map((d) => +d.slice(5, 7)))];
    const ms = $("#monthSel");
    const prev = state.month;
    ms.innerHTML = "";
    months.forEach((m) => ms.append(new Option(`2026년 ${m}월`, m)));
    state.month = months.includes(prev) ? prev : months[months.length - 1];
    ms.value = state.month;
    state.day = null;

    const s = state.school;
    $("#schoolInfo").innerHTML = `<strong>${esc(s.name)}</strong> · 세종시 ${esc(s.dong)} · 학생 ${fmt(s.students)}명 · 1끼 기준 ${fmt(s.standard.kcal)}kcal`;
    renderMonth();
    renderPrefs();
    renderCompare();
  }

  const monthDays = () => Object.keys(state.school.meals).filter((d) => +d.slice(5, 7) === state.month).sort();

  function renderMonth() {
    const days = monthDays();
    if (!state.day || !days.includes(state.day)) state.day = days[days.length - 1];
    renderKpis(days);
    renderCalendar(days);
    renderDay();
    renderKcal(days);
    renderMonthNut(days);
    renderWaste();
  }

  function renderKpis(days) {
    const s = state.school, meals = days.map((d) => s.meals[d]);
    const avgKcal = meals.reduce((a, m) => a + m.kcal, 0) / meals.length;
    const kcalPct = (avgKcal / s.standard.kcal) * 100;
    const wi = s.waste.findIndex((w) => w.month === state.month);
    const w = s.waste[wi], pw = s.waste[wi - 1];
    let delta = "전월 자료 없음", cls = "";
    if (pw) {
      const d = ((w.perPersonG - pw.perPersonG) / pw.perPersonG) * 100;
      cls = d <= 0 ? "good" : "bad";
      delta = `${d <= 0 ? "▼" : "▲"} 전월 대비 ${fmt(Math.abs(d), 1)}% ${d <= 0 ? "감소" : "증가"}`;
    }
    const top = s.preference.top[0];
    $("#kpis").innerHTML = `
      <div class="kpi"><div class="label">${state.month}월 평균 열량</div>
        <div class="value">${fmt(avgKcal)}<small>kcal</small></div>
        <div class="delta">기준 ${fmt(s.standard.kcal)}kcal의 ${fmt(kcalPct)}%</div></div>
      <div class="kpi"><div class="label">${state.month}월 1인 1끼 잔반</div>
        <div class="value">${fmt(w.perPersonG, 1)}<small>g</small></div>
        <div class="delta ${cls}">${delta}</div></div>
      <div class="kpi"><div class="label">${state.month}월 잔반 총량</div>
        <div class="value">${fmt(w.totalKg / 1000, 2)}<small>톤</small></div>
        <div class="delta">급식 ${w.servingDays}일 · ${fmt(w.totalKg)}kg</div></div>
      <div class="kpi"><div class="label">선호메뉴 1위</div>
        <div class="value" style="font-size:1.4rem">${esc(top.menu)}</div>
        <div class="delta">${fmt(top.votes)}표 · 응답자의 ${fmt(top.share, 1)}%</div></div>`;
  }

  function renderCalendar(days) {
    const cal = $("#calendar");
    cal.innerHTML = "";
    const y = 2026, m = state.month;
    const last = new Date(y, m, 0).getDate();
    let first = true;
    for (let d = 1; d <= last; d++) {
      const dt = new Date(y, m - 1, d), wd = dt.getDay();
      if (wd === 0 || wd === 6) continue;
      if (first) { for (let i = 1; i < wd; i++) cal.append(Object.assign(document.createElement("div"), { className: "day blank" })); first = false; }
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const meal = state.school.meals[iso];
      const el = document.createElement(meal ? "button" : "div");
      el.className = "day" + (meal ? "" : " empty") + (iso === state.day ? " sel" : "");
      if (meal) {
        el.type = "button";
        el.innerHTML = `<div class="d"><span>${d}</span><span class="k">${meal.kcal}</span></div>
          <div class="m">${meal.menu.map((x) => esc(x.name)).join(" · ")}</div>`;
        el.setAttribute("aria-label", `${m}월 ${d}일 식단, ${meal.kcal}킬로칼로리`);
        el.addEventListener("click", () => { state.day = iso; renderCalendar(days); renderDay(); });
      } else {
        el.innerHTML = `<div class="d"><span>${d}</span></div><div class="m">급식 없음</div>`;
      }
      cal.append(el);
    }
  }

  function nutRow(name, val, std, unit) {
    const pct = (val / std) * 100, w = Math.min(pct, 150) / 150 * 100;
    return `<div class="nut-row" title="${name} ${fmt(val, 1)}${unit} / 기준 ${fmt(std, 1)}${unit}">
      <span class="name">${name}</span>
      <span class="track"><span class="fill" style="width:${w}%"></span><span class="mark100" style="left:${100 / 1.5}%"></span></span>
      <span class="num"><span class="${pct < 80 ? "low" : ""}">${fmt(pct)}%</span> <span class="muted">${fmt(val, unit === "kcal" ? 0 : 1)}${unit}</span></span></div>`;
  }

  function renderDay() {
    const s = state.school, meal = s.meals[state.day];
    const dt = new Date(state.day + "T00:00:00");
    const wd = "일월화수목금토"[dt.getDay()];
    $("#dayTitle").textContent = `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${wd}) 식단`;
    $("#dayKcal").textContent = `${fmt(meal.kcal)} kcal · 기준의 ${fmt(meal.kcal / s.standard.kcal * 100)}%`;
    $("#dayMenu").innerHTML = meal.menu.map((x) =>
      `<li>${esc(x.name)}${x.allergy.length ? `<span class="alg" title="${x.allergy.map((a) => ALLERGY[a]).join(", ")}">${x.allergy.join(".")}</span>` : ""}</li>`).join("");
    $("#dayNut").innerHTML = [nutRow("열량", meal.kcal, s.standard.kcal, "kcal"),
      ...NUT.map((n) => nutRow(n.name, meal.nutrients[n.key], s.standard[n.key], n.unit))].join("");
    const used = [...new Set(meal.menu.flatMap((x) => x.allergy))].sort((a, b) => a - b);
    $("#allergyNote").textContent = used.length ? "알레르기 유발식품: " + used.map((a) => `${a}.${ALLERGY[a]}`).join(" ") : "알레르기 유발식품 없음";
  }

  /* ---------- Chart.js 공통 ---------- */
  function baseOpts(extra = {}) {
    const grid = css("--grid"), muted = css("--muted");
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: css("--surface"), titleColor: css("--text"), bodyColor: css("--text"),
          borderColor: css("--axis"), borderWidth: 1, padding: 10, displayColors: false },
      },
      scales: {
        x: { grid: { display: false }, border: { color: css("--axis") }, ticks: { color: muted, font: { size: 11 } } },
        y: { grid: { color: grid }, border: { display: false }, ticks: { color: muted, font: { size: 11 } }, beginAtZero: true },
      },
    }, extra);
  }
  function draw(id, config) {
    if (state.charts[id]) state.charts[id].destroy();
    state.charts[id] = new Chart(document.getElementById(id), config);
  }
  const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  function renderKcal(days) {
    const s = state.school, std = s.standard.kcal;
    const labels = days.map((d) => `${+d.slice(8)}일`);
    const vals = days.map((d) => s.meals[d].kcal);
    $("#kcalSub").textContent = `점선 = 기준 ${fmt(std)}kcal`;
    const opts = baseOpts();
    opts.scales.y.beginAtZero = false;
    opts.scales.y.suggestedMin = Math.round(std * 0.75 / 50) * 50;
    opts.scales.y.suggestedMax = Math.round(std * 1.2 / 50) * 50;
    opts.plugins.tooltip.callbacks = {
      label: (c) => c.datasetIndex === 0 ? `열량 ${fmt(c.raw)} kcal` : `기준 ${fmt(c.raw)} kcal`,
      afterBody: (items) => { const d = days[items[0].dataIndex]; return s.meals[d].menu.map((x) => x.name).join(", "); },
    };
    opts.onClick = (_, el) => { if (el.length) { state.day = days[el[0].index]; renderCalendar(days); renderDay(); } };
    draw("kcalChart", {
      type: "line",
      data: { labels, datasets: [
        { data: vals, borderColor: css("--s1"), backgroundColor: css("--s1"), borderWidth: 2, pointRadius: 3,
          pointHoverRadius: 6, pointBorderColor: css("--surface"), pointBorderWidth: 2, tension: 0.25 },
        { data: labels.map(() => std), borderColor: css("--muted"), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 0 },
      ] },
      options: opts,
    });
    $("#kcalTable").innerHTML = table(["날짜", "열량(kcal)", "기준 대비"],
      days.map((d) => [d.slice(5).replace("-", "/"), fmt(s.meals[d].kcal), fmt(s.meals[d].kcal / std * 100) + "%"]));
  }

  function renderMonthNut(days) {
    const s = state.school, meals = days.map((d) => s.meals[d]);
    const avg = (f) => meals.reduce((a, m) => a + f(m), 0) / meals.length;
    $("#monthNut").innerHTML = [nutRow("열량", avg((m) => m.kcal), s.standard.kcal, "kcal"),
      ...NUT.map((n) => nutRow(n.name, avg((m) => m.nutrients[n.key]), s.standard[n.key], n.unit))].join("");
    const c = avg((m) => m.nutrients.carb) * 4, p = avg((m) => m.nutrients.protein) * 4, f = avg((m) => m.nutrients.fat) * 9;
    const t = c + p + f;
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
        backgroundColor: s.waste.map((w) => w.month === state.month ? css("--s1") : css("--other")),
        hoverBackgroundColor: css("--s1"),
        borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 34 }] },
      options: opts,
    });
    $("#wasteTable").innerHTML = table(["월", "급식일", "1인 1끼(g)", "총량(kg)"],
      s.waste.map((w) => [`${w.month}월`, w.servingDays, fmt(w.perPersonG, 1), fmt(w.totalKg, 1)]));
  }

  function renderPrefs() {
    const pr = state.school.preference, max = pr.top[0].votes;
    $("#prefSub").textContent = `${pr.surveyDate} 설문 · 응답 ${fmt(pr.respondents)}명 · 복수응답`;
    $("#prefList").innerHTML = pr.top.map((t) => `<li title="${esc(t.menu)}: ${fmt(t.votes)}표 (${fmt(t.share, 1)}%)">
      <span class="rk">${t.rank}</span><span>${esc(t.menu)}</span>
      <span class="track"><span class="fill" style="width:${t.votes / max * 100}%"></span></span>
      <span class="num">${fmt(t.votes)}표</span></li>`).join("");
  }

  function renderCompare() {
    const list = [...state.schools].sort((a, b) => a.avgWastePerPersonG - b.avgWastePerPersonG);
    const opts = baseOpts();
    opts.indexAxis = "x";
    opts.plugins.tooltip.callbacks = {
      title: (i) => list[i[0].dataIndex].name,
      label: (c) => `1인 1끼 평균 잔반 ${fmt(c.raw, 1)} g`,
      afterLabel: (c) => `${LEVEL_NAME[list[c.dataIndex].level]} · 학생 ${fmt(list[c.dataIndex].students)}명`,
    };
    opts.onClick = (_, el) => { if (el.length) { const id = list[el[0].index].id; $("#schoolSel").value = id; selectSchool(id); } };
    opts.onHover = (e, el) => { e.native.target.style.cursor = el.length ? "pointer" : "default"; };
    draw("compareChart", {
      type: "bar",
      data: { labels: list.map((s) => s.name.replace(/(초등|중|고등)학교$/, (m) => ({ "초등학교": "초", "중학교": "중", "고등학교": "고" }[m]))),
        datasets: [{ data: list.map((s) => s.avgWastePerPersonG),
          backgroundColor: list.map((s) => s.id === state.school.id ? css("--s1") : css("--other")),
          hoverBackgroundColor: css("--s1"),
          borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 44 }] },
      options: opts,
    });
  }

  function toggleTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("theme", root.dataset.theme);
    renderMonth(); renderCompare();
  }

  init().catch((e) => {
    document.querySelector("main").insertAdjacentHTML("afterbegin",
      `<p class="card" style="margin-top:16px">데이터를 불러오지 못했습니다: ${esc(e.message)}<br>
      로컬에서 열 때는 <code>python3 -m http.server</code>로 서버를 실행한 뒤 접속하세요.</p>`);
  });
})();
