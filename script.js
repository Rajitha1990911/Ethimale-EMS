/*************************************************
 CONFIGURATION
*************************************************/
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwt6vurZwSF5xOMgrYrEfsrsyDT11sXFNIlNnTtRAyKNVvnPSfQ2mxk1sEqDGQCzkc/exec";

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
  document.getElementById(id).classList.add("active");
}

function buildInputs() {
  const container = document.getElementById("entryFields");
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
 VALIDATION
*************************************************/
function validateAllFields() {
  for (let f of [...internalFields, ...generationFields]) {
    const el = document.getElementById(f);
    if (el.value === "" || isNaN(el.value)) {
      alert(`${f} field is empty or invalid.`);
      el.focus();
      return false;
    }
  }
  return true;
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
  if (!validateAllFields()) return;

  const date = document.getElementById("date").value;
  if (!date) {
    alert("Please select the date.");
    return;
  }

  let record = { Date: date };

  internalFields.forEach(f => {
    record[f] = toMWh(
      Number(document.getElementById(f).value),
      document.getElementById(f + "_u").value
    );
  });

  generationFields.forEach(f => {
    record[f] = toMWh(
      Number(document.getElementById(f).value),
      document.getElementById(f + "_u").value
    );
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

    // 🔥 Always reload from Google Sheet
    loadLatestDailyData();

  } catch {
    document.getElementById("status").innerText =
      "Save failed. Please try again.";
  }
}

/*************************************************
 CHARTS
*************************************************/
let consumptionChart = null;
let balanceChart = null;

function renderConsumptionPie(data) {
  showTab("daily");

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
  showTab("balance");

  if (balanceChart) balanceChart.destroy();

  balanceChart = new Chart(
    document.getElementById("balanceChart"),
    {
      type: "bar",
      data: {
        labels: [
          "TG (Daily)",
          "DG (Daily)",
          "Internal",
          "Export",
          "Import",
          "Solar",
          "TG Balance Error",
          "DG Balance Error"
        ],
        datasets: [{
          data: [
            data.tg,
            data.dg,
            data.internal,
            data.export,
            data.import,
            data.solar,
            data.tgError,
            data.dgError
          ]
        }]
      }
    }
  );
}

/*************************************************
 LOAD DAILY DATA (SINGLE SOURCE OF TRUTH)
*************************************************/
async function loadLatestDailyData() {
  try {
    const res = await fetch(SCRIPT_URL);
    const data = await res.json();

    if (data.status === "not_enough_data") {
      document.getElementById("status").innerText =
        "Enter at least two days of data to view daily report.";
      return;
    }

    if (!data.today || !data.yesterday) return;

    const today = data.today;
    const yesterday = data.yesterday;

    let daily = {};
    internalFields.forEach(f => {
      daily[f] = Math.max(today[f] - yesterday[f], 0);
    });

    const boiler =
      daily["Boiler Main"] +
      daily["Feed Pump 1"] +
      daily["Feed Pump 2"] +
      daily["Feed Pump 3"] +
      daily["Wood Chipper"];

    const millNet = Math.max(daily["Mill"] - daily["ETP"], 0);
    const processNet = Math.max(
      daily["Process PCC"] - boiler - daily["Accommodation"],
      0
    );

    const internalTotal =
      millNet +
      processNet +
      boiler +
      daily["ETP"] +
      daily["Accommodation"] +
      daily["Distillery"];

    const tgDaily = today["TG"] - yesterday["TG"];
    const dgDaily = today["DG"] - yesterday["DG"];
    const exportDaily = today["Export"] - yesterday["Export"];
    const importDaily = today["Import"] - yesterday["Import"];
    const solarDaily = today["Solar"] - yesterday["Solar"];

    renderConsumptionPie({
      Mill: millNet,
      Process: processNet,
      Boiler: boiler,
      ETP: daily["ETP"],
      Accommodation: daily["Accommodation"],
      Distillery: daily["Distillery"]
    });

    renderBalanceChart({
      tg: tgDaily,
      dg: dgDaily,
      internal: internalTotal,
      export: exportDaily,
      import: importDaily,
      solar: solarDaily,
      tgError: tgDaily - (internalTotal + exportDaily),
      dgError: dgDaily - internalTotal
    });

  } catch (err) {
    console.error("Failed to load daily data", err);
  }
}

/*************************************************
 INIT
*************************************************/
buildInputs();
window.onload = loadLatestDailyData;
