// Dashboard logic: load data.json (exported from the dbt marts), then draw
// the KPI tiles, heatmap, personal bests and charts. The time filter is
// relative to the last run in the data, so the page shows the same thing
// no matter when someone opens it.

const ORANGE = "#fc4c02";
const ORANGE_2 = "#ff8a3d";
const MUTED = "#8a7b74";
const GRID = "#f3e7e1";
const DARK = "#2b2421";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let DATA = null;
const charts = {};

// ---------- formatting ----------

function formatPace(seconds) {
  if (seconds == null) return "–";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatDuration(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
  return h ? `${h}:${mmss}` : mmss;
}

function formatHours(minutes) {
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

function formatNumber(value, digits = 0) {
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function parseDate(iso) {
  // "2026-11-09" -> Date at midnight UTC (avoids the viewer's time zone shifting the day)
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function shortDate(iso) {
  return parseDate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function monthLabel(iso) {
  return parseDate(iso).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function hourLabel(h) {
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, "0")}:00 ${suffix}`;
}

// ---------- filtering ----------

function cutoffDate(days) {
  if (days === "all") return null;
  const last = parseDate(DATA.totals.last_run_date);
  last.setUTCDate(last.getUTCDate() - Number(days) + 1);
  return last;
}

function since(rows, key, cutoff) {
  return cutoff ? rows.filter((r) => parseDate(r[key]) >= cutoff) : rows;
}

// ---------- KPI tiles ----------

function renderKpis(runs) {
  const km = runs.reduce((sum, r) => sum + r.distance_km, 0);
  const minutes = runs.reduce((sum, r) => sum + r.moving_time_min, 0);
  const elevation = runs.reduce((sum, r) => sum + r.elevation_gain_m, 0);

  document.getElementById("kpi-distance").textContent = `${formatNumber(km, 1)} km`;
  // Average pace = total time / total distance (never the average of paces)
  document.getElementById("kpi-pace").textContent = km ? `${formatPace((minutes * 60) / km)} /km` : "–";
  document.getElementById("kpi-runs").textContent = formatNumber(runs.length);
  document.getElementById("kpi-time").textContent = formatHours(minutes);
  document.getElementById("kpi-elevation").textContent = `${formatNumber(elevation)} m`;
}

// ---------- heatmap: hour of day x weekday ----------

function heatColour(ratio) {
  // blend from a pale peach to the brand orange
  const from = [251, 238, 232];
  const to = [252, 76, 2];
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * ratio));
  return `rgb(${mix.join(",")})`;
}

function renderHeatmap(runs) {
  const counts = Array.from({ length: 24 }, () => Array(7).fill(0));
  for (const run of runs) {
    const hour = Number(run.started_at_local.slice(11, 13));
    const weekday = (parseDate(run.run_date).getUTCDay() + 6) % 7; // Mon = 0
    counts[hour][weekday] += 1;
  }
  const max = Math.max(1, ...counts.flat());

  let html = "<thead><tr><th></th>" + WEEKDAYS.map((d) => `<th>${d}</th>`).join("") + "</tr></thead><tbody>";
  counts.forEach((row, hour) => {
    html += `<tr><th class="hour" scope="row">${hourLabel(hour)}</th>`;
    for (const n of row) {
      const ratio = n / max;
      const bg = heatColour(n ? 0.15 + 0.85 * ratio : 0);
      const colour = ratio > 0.55 ? "#fff" : DARK;
      html += `<td style="background:${bg};color:${colour}">${n || ""}</td>`;
    }
    html += "</tr>";
  });
  document.getElementById("heatmap").innerHTML = html + "</tbody>";
}

// ---------- personal bests (always all-time) ----------

function renderPersonalBests() {
  const current = new Map();
  for (const pb of DATA.personal_bests) current.set(pb.effort, pb); // rows are sorted by date, so the last one wins

  const body = document.getElementById("pb-body");
  body.innerHTML = [...current.values()]
    .map(
      (pb) => `<tr>
        <td>${pb.effort}</td>
        <td class="time">${formatDuration(pb.best_time_s)}</td>
        <td>${formatPace(pb.pace_s_per_km)} /km</td>
        <td>${shortDate(pb.run_date)}</td>
        <td class="run">${pb.activity_name}</td>
        <td class="center"><a href="https://www.strava.com/activities/${pb.activity_id}" target="_blank" rel="noopener" aria-label="Open on Strava">↗</a></td>
      </tr>`
    )
    .join("");

  document.getElementById("pb-note").textContent =
    `All-time bests, found from the GPS tracks: the fastest stretch of each distance inside any run. ` +
    `${DATA.personal_bests.length} PBs set so far.`;
}

// ---------- charts ----------

function orangeFill(context) {
  const { chart } = context;
  const { ctx, chartArea } = chart;
  if (!chartArea) return "rgba(252,76,2,0.2)";
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, "rgba(252,76,2,0.45)");
  gradient.addColorStop(1, "rgba(255,138,61,0.05)");
  return gradient;
}

// Writes the value above the biggest weeks, like the peak labels in the design.
const peakLabels = {
  id: "peakLabels",
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets[0];
    if (!dataset || !dataset.peakLabels) return;
    const values = dataset.data;
    const max = Math.max(...values);
    const meta = chart.getDatasetMeta(0);
    const { ctx } = chart;
    ctx.save();
    ctx.font = "600 11px Inter, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    values.forEach((v, i) => {
      const window = values.slice(Math.max(0, i - 4), i + 5);
      if (v > 0 && v === Math.max(...window) && v >= max * 0.6) {
        const point = meta.data[i];
        ctx.fillText(formatNumber(v, 0), point.x, point.y - 8);
      }
    });
    ctx.restore();
  },
};

// Charts keep ISO dates as labels; axis ticks show a short "Jul 25" form.
function dateTick(value) {
  return monthLabel(this.getLabelForValue(value));
}

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: DARK,
        padding: 10,
        cornerRadius: 8,
        titleFont: { weight: "600" },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: MUTED, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: GRID },
        border: { display: false },
        ticks: { color: MUTED },
        beginAtZero: true,
      },
    },
  };
}

function renderWeekly(cutoff) {
  // include the week that contains the cutoff day
  const weekCutoff = cutoff ? new Date(cutoff.getTime() - 6 * 86400000) : null;
  const weeks = since(DATA.weekly, "week_start", weekCutoff);
  const labels = weeks.map((w) => w.week_start);
  const values = weeks.map((w) => w.distance_km);

  if (!charts.weekly) {
    const options = baseOptions();
    options.layout = { padding: { top: 18 } };
    options.scales.x.ticks.callback = dateTick;
    options.plugins.tooltip.callbacks = {
      title: (items) => `Week of ${shortDate(items[0].label)}`,
      label: (item) => {
        const w = item.chart.$weeks[item.dataIndex];
        return ` ${formatNumber(w.distance_km, 1)} km · ${w.runs} run${w.runs === 1 ? "" : "s"}`;
      },
    };
    charts.weekly = new Chart(document.getElementById("weekly-chart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: ORANGE,
          backgroundColor: orangeFill,
          fill: true,
          cubicInterpolationMode: "monotone",
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: ORANGE,
          peakLabels: true,
        }],
      },
      options,
      plugins: [peakLabels],
    });
  } else {
    charts.weekly.data.labels = labels;
    charts.weekly.data.datasets[0].data = values;
  }
  charts.weekly.$weeks = weeks;
  charts.weekly.update();
}

function renderFitness(cutoff) {
  const days = since(DATA.fitness, "day", cutoff);
  const labels = days.map((d) => d.day);
  const fitness = days.map((d) => d.fitness);
  const fatigue = days.map((d) => d.fatigue);

  if (!charts.fitness) {
    const options = baseOptions();
    options.plugins.legend = {
      display: true,
      position: "bottom",
      labels: { color: MUTED, usePointStyle: true, pointStyle: "line", boxWidth: 24 },
    };
    options.scales.x.ticks.callback = dateTick;
    options.plugins.tooltip.callbacks = {
      title: (items) => shortDate(items[0].label),
      label: (item) => ` ${item.dataset.label}: ${formatNumber(item.raw, 0)}`,
      afterBody: (items) => {
        const d = items[0].chart.$days[items[0].dataIndex];
        return `Form: ${d.form >= 0 ? "+" : ""}${formatNumber(d.form, 0)}`;
      },
    };
    charts.fitness = new Chart(document.getElementById("fitness-chart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Fitness (42-day load)",
            data: fitness,
            borderColor: ORANGE,
            backgroundColor: orangeFill,
            fill: true,
            cubicInterpolationMode: "monotone",
            borderWidth: 2.5,
            pointRadius: 0,
          },
          {
            label: "Fatigue (7-day load)",
            data: fatigue,
            borderColor: "#6e625c",
            borderDash: [5, 4],
            borderWidth: 1.5,
            cubicInterpolationMode: "monotone",
            pointRadius: 0,
          },
        ],
      },
      options,
    });
  } else {
    charts.fitness.data.labels = labels;
    charts.fitness.data.datasets[0].data = fitness;
    charts.fitness.data.datasets[1].data = fatigue;
  }
  charts.fitness.$days = days;
  charts.fitness.update();
}

function renderFormPill() {
  const latest = DATA.fitness[DATA.fitness.length - 1];
  const form = latest.form;
  const status = form > 5 ? "Fresh" : form < -10 ? "Tired" : "Balanced";
  document.getElementById("form-pill").textContent =
    `Form ${form >= 0 ? "+" : ""}${formatNumber(form, 0)} · ${status}`;
}

function renderPace(cutoff) {
  // include the month that contains the cutoff day
  const monthCutoff = cutoff ? new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 1)) : null;
  const months = since(DATA.monthly_pace, "month_start", monthCutoff);
  const labels = months.map((m) => monthLabel(m.month_start));

  if (!charts.pace) {
    const options = baseOptions();
    options.plugins.legend = {
      display: true,
      position: "bottom",
      labels: { color: MUTED, usePointStyle: true, boxWidth: 10 },
    };
    options.plugins.tooltip.callbacks = {
      label: (item) =>
        item.dataset.yAxisID === "km"
          ? ` Distance: ${formatNumber(item.raw, 1)} km`
          : ` ${item.dataset.label}: ${formatPace(item.raw)} /km`,
    };
    options.scales.y = {
      position: "left",
      reverse: true, // lower seconds = faster, so faster is higher on the chart
      grid: { color: GRID },
      border: { display: false },
      ticks: { color: MUTED, callback: (v) => formatPace(v) },
      title: { display: true, text: "pace /km (faster ↑)", color: MUTED },
    };
    options.scales.km = {
      position: "right",
      beginAtZero: true,
      grid: { display: false },
      border: { display: false },
      ticks: { color: MUTED },
      title: { display: true, text: "km", color: MUTED },
    };
    charts.pace = new Chart(document.getElementById("pace-chart"), {
      data: {
        labels,
        datasets: [
          {
            type: "line",
            label: "Pace",
            data: months.map((m) => m.pace_s_per_km),
            borderColor: ORANGE,
            backgroundColor: ORANGE,
            borderWidth: 2.5,
            cubicInterpolationMode: "monotone",
            pointRadius: 3,
            yAxisID: "y",
            order: 1,
          },
          {
            type: "line",
            label: "Grade-adjusted pace",
            data: months.map((m) => m.gap_pace_s_per_km),
            borderColor: ORANGE_2,
            backgroundColor: ORANGE_2,
            borderDash: [5, 4],
            borderWidth: 1.5,
            cubicInterpolationMode: "monotone",
            pointRadius: 0,
            yAxisID: "y",
            order: 2,
          },
          {
            type: "bar",
            label: "Distance",
            data: months.map((m) => m.distance_km),
            backgroundColor: "rgba(252,76,2,0.13)",
            borderRadius: 6,
            yAxisID: "km",
            order: 3,
          },
        ],
      },
      options,
    });
  } else {
    charts.pace.data.labels = labels;
    charts.pace.data.datasets[0].data = months.map((m) => m.pace_s_per_km);
    charts.pace.data.datasets[1].data = months.map((m) => m.gap_pace_s_per_km);
    charts.pace.data.datasets[2].data = months.map((m) => m.distance_km);
  }
  charts.pace.update();
}

// ---------- wiring ----------

function render(days) {
  const cutoff = cutoffDate(days);
  const runs = since(DATA.runs, "run_date", cutoff);
  renderKpis(runs);
  renderHeatmap(runs);
  renderWeekly(cutoff);
  renderFitness(cutoff);
  renderPace(cutoff);
}

// "Last updated" = when this data.json was exported (i.e. posted), shown in
// Nairobi time, plus the date of the latest run it contains.
function renderUpdated() {
  const posted = new Date(DATA.exported_at || DATA.totals.data_loaded_at);
  const day = posted.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });
  const time = posted.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
  document.getElementById("updated").textContent =
    `Last updated on ${day} at ${time} (Nairobi) · latest run ${shortDate(DATA.totals.last_run_date)}`;
}

async function main() {
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.color = MUTED;

  const response = await fetch("data.json");
  DATA = await response.json();

  renderUpdated();
  renderPersonalBests();
  renderFormPill();
  render("all");

  document.querySelectorAll(".filters button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filters button").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      render(button.dataset.days);
    });
  });
}

main();
