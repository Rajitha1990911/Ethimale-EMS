/*************************************************
 CONFIGURATION
*************************************************/
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMx622VubbeSZUw9SkF_CRE1yCkKpd66Ay94mTjVaaJiPw5GytEty2GV-lA8d190Qe/exec";

/*************************************************
 FIELD DEFINITIONS
*************************************************/
const internalFields = [
  "Mill",
  "Process PCC",
  "Boiler Main",
  "Feed Pump 1",
  "Feed Pump 2",
  "Feed Pump 3",
  "ETP",
  "Accommodation",
  "Wood Chipper",
  "Distillery"
];

const generationFields = [
  "TG",
  "DG",
  "Export",
  "Import",
  "Solar"
];

/*************************************************
 UI HELPERS
*************************************************/
function showTab(id) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function buildInputs() {
  const container = document.getElementById("entryFields");
  if (!container) return;

  container.innerHTML = "";

  [...internalFields, ...generationFields].forEach(f => {
    const div = document.createElement("div");
    div.className = "input-group";
    div.innerHTML = `
      <input type="number" step="any" id="${f}" placeholder="${f}">
      <select id="${f}_u">
        <option>MWh</option>
        <option>kWh</option>
        <option>GWh</option>
      </select>`;
    container.appendChild(div);
  });
}

/*************************************************
 UTILITIES
*************************************************/
function toMWh(value, unit) {
  if (unit === "kWh") return value / 1000;
  if (unit === "GWh") return value * 1000;
  return value;
}

function clearInputs() {
  document.querySelectorAll("input").forEach(i => {
    if (i.type !== "date") i.value = "";
  });
}

/*************************************************
 SAVE CUMULATIVE DATA
*************************************************/
function saveCumulative() {
  const dateEl = document.getElementById("date");
  if (!dateEl || !dateEl.value) {
    alert("Please select the date.");
    return;
  }

  let record = { Date: dateEl.value };

  [...internalFields, ...generationFields].forEach(f => {
    const val = document.getElementById(f);
    const unit = document.getElementById(f + "_u");
    if (!val || !unit || val.value === "") {
      alert(`${f} field is empty`);
      return;
    }
    record[f] = toMWh(Number(val.value), unit.value);
  });

  postToSheet(record);
}

async function postToSheet(data) {
  const body = new URLSearchParams();
  Object.keys(data).forEach(k => body.append(k, data[k]));

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body
    });

    if (!res.ok) throw new Error();

    document.getElementById("status").innerText =
      "Cumulative readings saved.";

    clearInputs();
    loadLatestDailyData();

  } catch {
    document.getElementById("status").innerText =
      "Save failed.";
  }
}

/*************************************************
 CHARTS (SAFE)
*************************************************/
let consumptionChart = null;
let balanceChart = null;

function renderConsumptionPie(data) {
  if (consumptionChart) consumptionChart.destroy();
  consumptionChart = new Chart(
    document.getElementById("consumptionPie"),
    {
      type: "pie",
      data: {
        labels: Object.keys(data),
        datasets: [{ data: Object.values(data) }]
      }
    }
  );
}

function renderBalanceChart(data) {
  if (balanceChart) balanceChart.destroy();
  balanceChart = new Chart(
    document.getElementById("balanceChart"),
    {
      type: "bar",
      data: {
        labels: Object.keys(data),
        datasets: [{ data: Object.values(data) }]
      }
    }
  );
}

/*************************************************
 LOAD DAILY DATA
*************************************************/
async function loadLatestDailyData() {
  try {
    const res = await fetch(SCRIPT_URL);
    const data = await res.json();

    if (data.status === "not_enough_data") return;
    if (!data.today || !data.yesterday) return;

    const today = data.today;
    const yesterday = data.yesterday;

    let daily = {};
    internalFields.forEach(f => {
      daily[f] = Math.max(today[f] - yesterday[f], 0);
    });

    renderConsumptionPie(daily);
    renderBalanceChart(daily);

  } catch (e) {
    console.error("Load failed", e);
  }
}

/*************************************************
 INIT
*************************************************/
buildInputs();
window.onload = loadLatestDailyData;
