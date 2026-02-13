/*********************************
 CONFIG
*********************************/
const SCRIPT_URL = "https://docs.google.com/spreadsheets/d/1y8_gS9rYNnwCoYISrtAv3Tmx4xG8IA4m_uc3QBNaOWo/edit?gid=0#gid=0";

/*********************************
 FIELD DEFINITIONS
*********************************/
const internalFields = [
  "Mill","Process PCC","Boiler Main",
  "Feed Pump 1","Feed Pump 2","Feed Pump 3",
  "ETP","Accommodation","Wood Chipper","Distillery"
];

const generationFields = [
  "TG","DG","Export","Import","Solar"
];

let cumulativeHistory = [];

/*********************************
 UI
*********************************/
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

/*********************************
 UTILITIES
*********************************/
function toMWh(val, unit) {
  if (unit === "kWh") return val / 1000;
  if (unit === "GWh") return val * 1000;
  return val;
}

function safeNumber(id) {
  const raw = document.getElementById(id).value;
  return raw === "" ? 0 : Number(raw);
}

function clearInputs() {
  document.querySelectorAll("input").forEach(i => {
    if (i.type !== "date") i.value = "";
  });
}

/*********************************
 SAVE CUMULATIVE DATA
*********************************/
function saveCumulative() {
  const date = document.getElementById("date").value;
  if (!date) {
    alert("Please select date");
    return;
  }

  let record = { Date: date };

  internalFields.forEach(f => {
    record[f] = toMWh(
      safeNumber(f),
      document.getElementById(f + "_u").value
    );
  });

  generationFields.forEach(f => {
    record[f] = toMWh(
      safeNumber(f),
      document.getElementById(f + "_u").value
    );
  });

  cumulativeHistory.push(record);

  // SEND FLAT JSON (matches sheet headers)
  fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });

  document.getElementById("status").innerText =
    cumulativeHistory.length === 1
      ? "Baseline saved. Daily report available from tomorrow."
      : "Cumulative readings saved.";

  clearInputs();

  if (cumulativeHistory.length > 1) {
    calculateDaily();
  }
}

/*********************************
 DAILY CALCULATION
*********************************/
function calculateDaily() {
  const today = cumulativeHistory[cumulativeHistory.length - 1];
  const yesterday = cumulativeHistory[cumulativeHistory.length - 2];

  let daily = {};
  internalFields.forEach(f => {
    daily[f] = today[f] - yesterday[f];
  });

  // INTERNAL LOGIC
  const boiler =
    daily["Boiler Main"] +
    daily["Feed Pump 1"] +
    daily["Feed Pump 2"] +
    daily["Feed Pump 3"] +
    daily["Wood Chipper"];

  const millNetRaw = daily["Mill"] - daily["ETP"];
  const processNetRaw =
    daily["Process PCC"] - boiler - daily["Accommodation"];

  const millNet = millNetRaw > 0 ? millNetRaw : 0;
  const processNet = processNetRaw > 0 ? processNetRaw : 0;

  const internalTotal =
    millNet +
    processNet +
    boiler +
    daily["ETP"] +
    daily["Accommodation"] +
    daily["Distillery"];

  // DAILY GENERATION (CUMULATIVE → DAILY)
  const tgDaily = today["TG"] - yesterday["TG"];
  const exportDaily = today["Export"] - yesterday["Export"];
  const importDaily = today["Import"] - yesterday["Import"];

  renderConsumptionPie({
    Mill: millNet,
    Process: processNet,
    Boiler: boiler,
    ETP: daily["ETP"],
    Accommodation: daily["Accommodation"],
    Distillery: daily["Distillery"]
  });

  renderBalanceChart(tgDaily, internalTotal, exportDaily);
}

/*********************************
 CHARTS
*********************************/
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

function renderBalanceChart(tg, internal, exportVal) {
  showTab("balance");

  new Chart(document.getElementById("balanceChart"), {
    type: "bar",
    data: {
      labels: ["TG Generation", "Internal Consumption", "Export"],
      datasets: [{ data: [tg, internal, exportVal] }]
    }
  });
}

/*********************************
 PDF (BACKEND)
*********************************/
function generatePDF() {
  alert(
    "Daily PDF is generated via Google Apps Script and saved to Google Drive."
  );
}
