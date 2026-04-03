(function () {
  "use strict";

  const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];
  const COLORS = {
    primary: "#667eea",
    secondary: "#764ba2",
    accent: "#f093fb",
    doughnut: ["#667eea", "#764ba2", "#f093fb"],
  };

  const chartRefs = { line: null, doughnut: null, bar: null, hbar: null, radar: null };

  let bundle = null;

  function kcalFromMacros(row) {
    return 4 * row.carb + 4 * row.protein + 9 * row.fat;
  }

  function parseMonthKey(monthStr) {
    const [y, m] = monthStr.split("-").map(Number);
    return y * 12 + m;
  }

  function formatMonthLabel(monthStr) {
    const [y, m] = monthStr.split("-");
    return `${y}년 ${Number(m)}월`;
  }

  function formatDateLabel(iso) {
    const d = new Date(iso + "T12:00:00");
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(d);
  }

  function getMonday(d) {
    const x = new Date(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function maxMenuDate(menuRows) {
    let max = "";
    menuRows.forEach((r) => {
      if (r.date > max) max = r.date;
    });
    return max;
  }

  function clipDateForData(todayIso, maxIso) {
    if (!maxIso) return todayIso;
    return todayIso > maxIso ? maxIso : todayIso;
  }

  function pickSchool(rows, school) {
    if (!school) return rows;
    return rows.filter((r) => r.school === school);
  }

  async function loadData() {
    const r = await fetch("data.json", { cache: "no-store" });
    if (!r.ok) throw new Error("data.json을 불러올 수 없습니다.");
    return r.json();
  }

  function destroyCharts() {
    Object.keys(chartRefs).forEach((k) => {
      if (chartRefs[k]) {
        chartRefs[k].destroy();
        chartRefs[k] = null;
      }
    });
  }

  function getSelectedSchool() {
    const v = document.getElementById("school-select").value;
    return v === "" ? null : v;
  }

  function schoolScopeLabel(school) {
    return school || "전체 학교 평균";
  }

  function fillSummary({
    menu,
    nutrition,
    calorie,
    waste,
    favorite,
    referenceIso,
    school,
  }) {
    const scope = schoolScopeLabel(school);
    const refNutrition = pickSchool(nutrition, school).filter(
      (n) => n.date === referenceIso
    );
    const calorieHintEl = document.getElementById("card-calorie-hint");
    if (refNutrition.length) {
      const avg =
        refNutrition.reduce((s, n) => s + kcalFromMacros(n), 0) / refNutrition.length;
      document.getElementById("card-calorie").textContent =
        `${Math.round(avg).toLocaleString("ko-KR")} kcal`;
      calorieHintEl.textContent = school
        ? `기준일: ${formatDateLabel(referenceIso)} · ${school}`
        : `기준일: ${formatDateLabel(referenceIso)} (${scope})`;
    } else {
      const cal = pickSchool(calorie, school);
      const byMonth = {};
      cal.forEach((c) => {
        if (!byMonth[c.month]) byMonth[c.month] = [];
        byMonth[c.month].push(c.avg_calorie);
      });
      const months = Object.keys(byMonth).sort();
      const lastM = months[months.length - 1];
      const avgLast =
        lastM &&
        byMonth[lastM].reduce((a, b) => a + b, 0) / byMonth[lastM].length;
      document.getElementById("card-calorie").textContent = avgLast
        ? `${Math.round(avgLast).toLocaleString("ko-KR")} kcal`
        : "—";
      calorieHintEl.textContent = lastM
        ? `해당일 영양 데이터 없음 · 월 평균 (${formatMonthLabel(lastM)}) · ${scope}`
        : "데이터 없음";
    }

    const today = new Date();
    const ymNow = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const wAll = pickSchool(waste, school);
    let wasteMonth = ymNow;
    let wasteRows = wAll.filter((w) => w.month === ymNow);
    if (!wasteRows.length) {
      const months = [...new Set(wAll.map((w) => w.month))].sort();
      wasteMonth = months[months.length - 1];
      wasteRows = wAll.filter((w) => w.month === wasteMonth);
    }
    if (wasteRows.length) {
      const avgW =
        wasteRows.reduce((s, w) => s + w.waste_per_person_g, 0) / wasteRows.length;
      document.getElementById("card-waste").textContent = `${avgW.toFixed(1)} g/인`;
      document.getElementById("card-waste-hint").textContent =
        wasteMonth === ymNow
          ? `${formatMonthLabel(wasteMonth)} · ${scope}`
          : `최근 데이터: ${formatMonthLabel(wasteMonth)} · ${scope}`;
    } else {
      document.getElementById("card-waste").textContent = "—";
      document.getElementById("card-waste-hint").textContent = "";
    }

    const menuF = pickSchool(menu, school);
    const uniqueDays = new Set(menuF.map((m) => m.date)).size;
    document.getElementById("card-meal-days").textContent =
      uniqueDays.toLocaleString("ko-KR");
    document.getElementById("card-meal-days-hint").textContent = school
      ? `${school} 급식이 있는 고유 일수`
      : "전체 학교 통합 기준 고유 일자";

    const favF = pickSchool(favorite, school);
    let top = null;
    if (school) {
      top = favF.find((f) => f.rank === 1) || null;
      if (!top && favF.length) {
        top = [...favF].sort((a, b) => b.score - a.score)[0];
      }
    } else {
      favorite.forEach((f) => {
        if (!top || f.score > top.score) top = f;
      });
    }
    if (top) {
      document.getElementById("card-favorite").textContent = top.menu;
      document.getElementById("card-favorite-hint").textContent = school
        ? `선호도 ${top.score.toFixed(1)}점 · ${school}`
        : `선호도 점수 ${top.score.toFixed(1)}점 · ${top.school}`;
    } else {
      document.getElementById("card-favorite").textContent = "—";
      document.getElementById("card-favorite-hint").textContent = "";
    }
  }

  function gridColor() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "rgba(255,255,255,0.08)"
      : "rgba(102, 126, 234, 0.12)";
  }

  function tickColor() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "#c4c4d8"
      : "#5c5c76";
  }

  function chartOptions(legendBottom) {
    const legend = {
      labels: {
        color: tickColor(),
        font: { family: "Malgun Gothic, sans-serif", size: 12 },
        usePointStyle: true,
      },
    };
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      animation: { duration: 900, easing: "easeOutQuart" },
      plugins: {
        legend: {
          display: legendBottom,
          position: "bottom",
          ...legend,
        },
        tooltip: {
          animation: { duration: 200 },
          backgroundColor: "rgba(30, 30, 42, 0.92)",
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
        },
      },
    };
  }

  function buildLineChartCalorie(calorie, lineLabel) {
    const byMonth = {};
    calorie.forEach((c) => {
      if (!byMonth[c.month]) byMonth[c.month] = [];
      byMonth[c.month].push(c.avg_calorie);
    });
    const sorted = Object.keys(byMonth).sort(
      (a, b) => parseMonthKey(a) - parseMonthKey(b)
    );
    const labels = sorted.map(formatMonthLabel);
    const values = sorted.map(
      (m) => byMonth[m].reduce((a, b) => a + b, 0) / byMonth[m].length
    );
    const ctx = document.getElementById("chart-calorie-line");
    const gradient = ctx.getContext("2d").createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, "rgba(102, 126, 234, 0.45)");
    gradient.addColorStop(1, "rgba(240, 147, 251, 0.05)");
    const lnOpts = chartOptions(false);
    chartRefs.line = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: lineLabel,
            data: values,
            tension: 0.45,
            fill: true,
            backgroundColor: gradient,
            borderColor: COLORS.primary,
            borderWidth: 2.5,
            pointBackgroundColor: COLORS.secondary,
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: COLORS.accent,
            pointHoverBorderColor: "#fff",
            pointRadius: 4,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        ...lnOpts,
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: gridColor() },
            ticks: { color: tickColor() },
          },
          x: {
            grid: { display: false },
            ticks: { color: tickColor() },
          },
        },
      },
    });
  }

  function buildDoughnutNutrition(nutrition) {
    let carb = 0;
    let protein = 0;
    let fat = 0;
    nutrition.forEach((n) => {
      carb += n.carb;
      protein += n.protein;
      fat += n.fat;
    });
    const ctx = document.getElementById("chart-macro-doughnut");
    chartRefs.doughnut = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["탄수화물 (g)", "단백질 (g)", "지방 (g)"],
        datasets: [
          {
            data: [carb, protein, fat],
            backgroundColor: COLORS.doughnut,
            hoverOffset: 12,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.9)",
          },
        ],
      },
      options: {
        ...chartOptions(true),
        cutout: "58%",
      },
    });
  }

  function buildBarWaste(waste) {
    const byMonth = {};
    waste.forEach((w) => {
      if (!byMonth[w.month]) byMonth[w.month] = [];
      byMonth[w.month].push(w.waste_per_person_g);
    });
    const months = Object.keys(byMonth).sort(
      (a, b) => parseMonthKey(a) - parseMonthKey(b)
    );
    const labels = months.map(formatMonthLabel);
    const data = months.map(
      (m) => byMonth[m].reduce((a, b) => a + b, 0) / byMonth[m].length
    );
    const ctx = document.getElementById("chart-waste-bar");
    const baseOpts = chartOptions(false);
    chartRefs.bar = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "1인당 잔반 (g)",
            data,
            borderRadius: 8,
            borderSkipped: false,
            backgroundColor(context) {
              const chart = context.chart;
              const { ctx: c, chartArea } = chart;
              if (!chartArea) return COLORS.primary;
              const g = c.createLinearGradient(
                0,
                chartArea.bottom,
                0,
                chartArea.top
              );
              g.addColorStop(0, COLORS.primary);
              g.addColorStop(0.5, COLORS.secondary);
              g.addColorStop(1, COLORS.accent);
              return g;
            },
          },
        ],
      },
      options: {
        ...baseOpts,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: gridColor() },
            ticks: { color: tickColor() },
          },
          x: {
            grid: { display: false },
            ticks: { color: tickColor() },
          },
        },
        plugins: {
          ...baseOpts.plugins,
          legend: { display: false },
        },
      },
    });
  }

  function buildHorizontalFavorite(favorite, school) {
    let labels;
    let data;
    if (school) {
      const rows = favorite
        .filter((f) => f.school === school)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 10);
      labels = rows.map((r) => r.menu).reverse();
      data = rows.map((r) => r.score).reverse();
    } else {
      const best = new Map();
      favorite.forEach((f) => {
        const prev = best.get(f.menu);
        if (!prev || f.score > prev.score) best.set(f.menu, f);
      });
      const sorted = [...best.entries()]
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 10);
      labels = sorted.map(([name]) => name).reverse();
      data = sorted.map(([, v]) => v.score).reverse();
    }
    const ctx = document.getElementById("chart-favorite-hbar");
    const hbOpts = chartOptions(false);
    chartRefs.hbar = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "선호도 점수",
            data,
            backgroundColor: "rgba(118, 75, 162, 0.75)",
            borderColor: COLORS.primary,
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        ...hbOpts,
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: gridColor() },
            ticks: { color: tickColor() },
          },
          y: {
            grid: { display: false },
            ticks: { color: tickColor(), font: { size: 11 } },
          },
        },
        plugins: { ...hbOpts.plugins, legend: { display: false } },
      },
    });
  }

  function buildRadarWeekday(nutrition) {
    const sums = Object.fromEntries(DAY_ORDER.map((d) => [d, { sum: 0, n: 0 }]));
    nutrition.forEach((row) => {
      if (!sums[row.day]) return;
      sums[row.day].sum += kcalFromMacros(row);
      sums[row.day].n += 1;
    });
    const labels = DAY_ORDER;
    const data = labels.map((d) =>
      sums[d].n ? Math.round(sums[d].sum / sums[d].n) : 0
    );
    const ctx = document.getElementById("chart-weekday-radar");
    chartRefs.radar = new Chart(ctx, {
      type: "radar",
      data: {
        labels: labels.map((d) => `${d}요일`),
        datasets: [
          {
            label: "평균 칼로리 (kcal)",
            data,
            borderColor: COLORS.primary,
            backgroundColor: "rgba(102, 126, 234, 0.25)",
            pointBackgroundColor: COLORS.accent,
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: COLORS.secondary,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...chartOptions(true),
        scales: {
          r: {
            beginAtZero: true,
            grid: { color: gridColor() },
            angleLines: { color: gridColor() },
            pointLabels: { color: tickColor(), font: { size: 12 } },
            ticks: {
              backdropColor: "transparent",
              color: tickColor(),
            },
          },
        },
      },
    });
  }

  function fillWeekTable(menu, referenceIso, school, allSchools) {
    const schools = school ? [school] : allSchools;
    const refDate = new Date(referenceIso + "T12:00:00");
    const monday = getMonday(refDate);
    const note = document.getElementById("week-table-note");
    const scope = school ? `${school}만` : "전체 학교";
    note.textContent = `기준 주간: ${formatDateLabel(toISODate(monday))}부터 · ${scope}`;

    const byKey = new Map();
    menu.forEach((m) => {
      byKey.set(`${m.date}|${m.school}`, m.menu);
    });

    const thead = document.getElementById("week-meal-thead");
    thead.innerHTML = "";
    const headTr = document.createElement("tr");
    ["날짜", "요일"].forEach((text) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      headTr.appendChild(th);
    });
    if (school) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = "식단";
      headTr.appendChild(th);
    } else {
      schools.forEach((name) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = name;
        headTr.appendChild(th);
      });
    }
    thead.appendChild(headTr);

    const tbody = document.getElementById("week-meal-body");
    tbody.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      const iso = toISODate(d);
      const dayChar = DAY_ORDER[(d.getDay() + 6) % 7];
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = iso;
      tr.appendChild(tdDate);

      const tdDay = document.createElement("td");
      tdDay.textContent = `${dayChar}요일`;
      tr.appendChild(tdDay);

      schools.forEach((sch) => {
        const td = document.createElement("td");
        const items = byKey.get(`${iso}|${sch}`);
        if (items && items.length) {
          const ul = document.createElement("ul");
          ul.className = "meal-menu-list";
          items.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            ul.appendChild(li);
          });
          td.appendChild(ul);
        } else {
          td.className = "empty-cell";
          td.textContent = "식단 없음";
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem("meal-dash-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved ? saved === "dark" : prefersDark;
    applyTheme(dark);
    document.getElementById("theme-toggle").addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      applyTheme(!isDark);
      localStorage.setItem("meal-dash-theme", !isDark ? "dark" : "light");
    });
  }

  function applyTheme(dark) {
    const root = document.documentElement;
    const btn = document.getElementById("theme-toggle");
    if (dark) {
      root.setAttribute("data-theme", "dark");
      btn.querySelector(".theme-toggle__icon").textContent = "☀️";
      btn.querySelector(".theme-toggle__label").textContent = "라이트 모드";
    } else {
      root.removeAttribute("data-theme");
      btn.querySelector(".theme-toggle__icon").textContent = "🌙";
      btn.querySelector(".theme-toggle__label").textContent = "다크 모드";
    }
  }

  function populateSchoolSelect(schools) {
    const sel = document.getElementById("school-select");
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "전체 학교 평균";
    sel.appendChild(optAll);
    schools.forEach((name) => {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });
    const saved = localStorage.getItem("meal-dash-school");
    if (saved !== null && (saved === "" || schools.includes(saved))) {
      sel.value = saved;
    }
    sel.addEventListener("change", () => {
      localStorage.setItem("meal-dash-school", sel.value);
      renderDashboard();
    });
  }

  function renderDashboard() {
    if (!bundle) return;
    const school = getSelectedSchool();
    const meta = bundle.meta || {};
    const allSchools = meta.schools || ["세종초", "세종중", "세종고"];

    const menu = pickSchool(bundle.menu || [], school);
    const nutrition = pickSchool(bundle.nutrition || [], school);
    const calorie = pickSchool(bundle.calorie || [], school);
    const waste = pickSchool(bundle.waste || [], school);
    const favorite = pickSchool(bundle.favorite || [], school);

    const maxIso = maxMenuDate(menu);
    const todayIso = toISODate(new Date());
    const referenceIso = clipDateForData(todayIso, maxIso);

    fillSummary({
      menu,
      nutrition,
      calorie,
      waste,
      favorite,
      referenceIso,
      school,
    });

    fillWeekTable(menu, referenceIso, school, allSchools);

    destroyCharts();
    const lineLabel = school
      ? `${school} 월 평균 칼로리`
      : "전체 학교 월 평균 칼로리";
    buildLineChartCalorie(calorie, lineLabel);
    buildDoughnutNutrition(nutrition);
    buildBarWaste(waste);
    buildHorizontalFavorite(bundle.favorite || [], school);
    buildRadarWeekday(nutrition);
  }

  async function main() {
    initTheme();
    document.getElementById("header-date").textContent = new Intl.DateTimeFormat(
      "ko-KR",
      { dateStyle: "full" }
    ).format(new Date());

    try {
      const data = await loadData();
      bundle = data;
      const meta = data.meta || {};
      const allSchools = meta.schools || ["세종초", "세종중", "세종고"];

      const title = meta.title || "세종시교육청 급식 대시보드";
      document.getElementById("dashboard-title").textContent = title;
      document.title = title;

      populateSchoolSelect(allSchools);
      renderDashboard();
    } catch (e) {
      const mainEl = document.querySelector("main.container");
      if (mainEl) {
        const err = document.createElement("div");
        err.className = "card";
        err.style.marginTop = "1rem";
        err.innerHTML =
          "<h2>데이터를 불러오지 못했습니다</h2><p>HTTP로 페이지를 열어 주세요. (<code>index.html</code>을 파일로 직접 열면 fetch가 차단될 수 있습니다. <code>npx serve</code> 또는 Live Server 사용을 권장합니다.)</p>";
        mainEl.prepend(err);
      }
      console.error(e);
    }
  }

  main();
})();
