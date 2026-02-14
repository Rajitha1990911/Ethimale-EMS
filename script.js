/*************************************************
 CONFIGURATION
*************************************************/
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbymowNxNuIoeI-bhxkF1r2hhbmqymB3frz3qJkqEoNJ-uWykxyWVVnWVzzaW-5yU327/exec";

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

let cumulativeHistory = [];

/*************************************************
 UI HELPERS
*************************************************/
function showTab(id) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function buildInputs() {
  const container = document.getElementById("entryFields");
  [...internalFields, ...generationFields].forEach(f => {
    const div = document.createElement("div");
    div.className = "input-group";
    div.innerHTML = `
      <input id="${f}" placeholder="${f}">
      <select id="${f}_u">
        <option>MWh</option>
        <option>kWh</option>
        <option>GWh</option>
      </select>`;
    container.appendChild(div);
  });
}
buildInputs();

/*************************************************
 VALIDATION
*************************************************/
function validateAllFields() {
  for (let f of [...internalFields, ...generationFields]) {
    const el = document.getElementById(f);
    if (el.value === "") {
      alert(`${f} field is empty. Please enter the cumulative reading.`);
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

  cumulativeHistory.push(record);

  // Append to Google Sheet
  fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });

  document.getElementById("status").innerText =
    cumulativeHistory.length === 1
      ? "Baseline saved. Daily report will be available from tomorrow."
      : "Cumulative readings saved.";

  clearInputs();

  if (cumulativeHistory.length > 1) {
    calculateDaily();
  }
}

/*************************************************
 DAILY CALCULATION
*************************************************/
function calculateDaily() {

  const today = cumulativeHistory[cumulativeHistory.length - 1];
  const yesterday = cumulativeHistory[cumulativeHistory.length - 2];

  /* -------- INTERNAL DAILY -------- */
  let daily = {};
  internalFields.forEach(f => {
    daily[f] = today[f] - yesterday[f];
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

  /* -------- GENERATION DAILY -------- */
  const tgDaily = today["TG"] - yesterday["TG"];
  const dgDaily = today["DG"] - yesterday["DG"];
  const exportDaily = today["Export"] - yesterday["Export"];
  const importDaily = today["Import"] - yesterday["Import"];
  const solarDaily = today["Solar"] - yesterday["Solar"];

  const tgBalanceError =
    tgDaily - (internalTotal + exportDaily);

  const dgBalanceError =
    dgDaily > 0 ? dgDaily - internalTotal : 0;

  /* -------- VISUALS -------- */
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
    tgError: tgBalanceError,
    dgError: dgBalanceError
  });
}

/*************************************************
 CHARTS
*************************************************/
function renderConsumptionPie(data) {
  showTab("daily");
  new Chart(document.getElementById("consumptionPie"), {
    type: "pie",
    data: {
      labels: Object.keys(data),
      datasets: [{ data: Object.values(data) }]
    }
  });
}

function renderBalanceChart(data) {
  showTab("balance");
  new Chart(document.getElementById("balanceChart"), {
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
  });
}

/*************************************************
 PDF PLACEHOLDER
*************************************************/
function generatePDF() {
  alert("Daily PDF will be generated via Google Apps Script.");
}
