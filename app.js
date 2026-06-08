const IP_JSON_URL = "data/ip_ranges.json";
const LAST_MODIFIED_URL = "data/last_modified.txt";

const CELL_MAP = {
  ok1: "us_cell_1",
  ok2: "us_cell_2",
  ok3: "us_cell_3",
  ok4: "us_cell_4",
  ok5: "us_cell_5",
  ok6: "us_cell_6",
  ok7: "us_cell_7",
  ok8: "apac_cell_1",
  eu1: "emea_cell_1",
  ok9: "emea_cell_2",
  ok10: "us_cell_10",
  ok11: "us_cell_11",
  ok12: "us_cell_12",
  ok14: "us_cell_14",
  ok16: "apac_cell_2",
  op1: "preview_cell_1",
  op2: "preview_cell_2",
  op3: "preview_cell_3"
};

const tenantInput = document.getElementById("tenantUrl");
const lookupBtn = document.getElementById("lookupBtn");
const manualCell = document.getElementById("manualCell");
const manualBtn = document.getElementById("manualBtn");
const message = document.getElementById("message");
const results = document.getElementById("results");
const resultTitle = document.getElementById("resultTitle");
const resultMeta = document.getElementById("resultMeta");
const ipOutput = document.getElementById("ipOutput");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const jsonStatus = document.getElementById("jsonStatus");
const mappingTable = document.getElementById("mappingTable");

let currentRanges = [];
let currentKey = "";
let cachedIpJson = null;
let cachedLastModified = "";

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = `message ${isError ? "error" : ""}`;
}

function hideMessage() {
  message.className = "message hidden";
  message.textContent = "";
}

function renderMappingTable() {
  mappingTable.innerHTML = Object.entries(CELL_MAP)
    .map(([cell, key]) => `<div class="mapping-row"><strong>${cell.toUpperCase()}</strong><code>${key}</code></div>`)
    .join("");
}

function isUnsupportedTenant(hostname) {
  const host = hostname.toLowerCase();
  return host.endsWith(".okta.gov") || host === "okta.gov" || host.endsWith(".okta.mil") || host === "okta.mil";
}

function normalizeTenantUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Enter an Okta tenant URL.");

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (isUnsupportedTenant(url.hostname)) {
    throw new Error("*.okta.gov and *.okta.mil tenants are not supported by this tool.");
  }

  return `${url.origin}/.well-known/okta-organization`;
}

function extractCellFromOrgMetadata(data) {
  const text = JSON.stringify(data).toLowerCase();
  const directKeys = ["cell", "okta_cell", "oktaCell", "cellId", "cell_id", "pipeline", "environment"];

  for (const key of directKeys) {
    if (data[key] && typeof data[key] === "string") {
      const match = data[key].toLowerCase().match(/(ok\d+|eu\d+|op\d+|preview\d+)/);
      if (match) return match[1];
    }
  }

  const match = text.match(/(ok\d+|eu\d+|op\d+|preview\d+)/);
  if (match) return match[1];

  throw new Error("Could not detect the Okta cell from the organization metadata.");
}

function mapCellToIpRangeKey(cellOrKey) {
  const value = cellOrKey.trim().toLowerCase().replace(/\s+/g, "");
  if (!value) throw new Error("Enter a cell or IP range key.");

  if (CELL_MAP[value]) return CELL_MAP[value];

  if (value.includes("_cell_") || value.includes("_pam_cell_") || value.includes("cell_")) {
    return value;
  }

  const previewMatch = value.match(/^preview(\d+)$/);
  if (previewMatch) return `preview_cell_${previewMatch[1]}`;

  throw new Error(`Unsupported or unknown cell "${cellOrKey}". Try entering the exact JSON key manually.`);
}

function flattenRanges(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenRanges);
  if (typeof value === "string") return [value];

  if (typeof value === "object") {
    const possibleKeys = ["ip_ranges", "ranges", "cidrs", "ipv4", "ipv6"];
    let found = [];

    for (const key of possibleKeys) {
      if (value[key]) found = found.concat(flattenRanges(value[key]));
    }

    if (found.length) return found;
    return Object.values(value).flatMap(flattenRanges);
  }

  return [];
}

async function fetchLastModified() {
  try {
    const response = await fetch(LAST_MODIFIED_URL, { cache: "no-store" });
    if (!response.ok) return "";
    const text = await response.text();
    cachedLastModified = text.trim();
    return cachedLastModified;
  } catch {
    return "";
  }
}

async function fetchIpJson() {
  if (cachedIpJson) return cachedIpJson;

  const response = await fetch(IP_JSON_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load local Okta IP range JSON from ${IP_JSON_URL}. HTTP ${response.status}`);
  }

  cachedIpJson = await response.json();

  if (cachedIpJson.__placeholder) {
    throw new Error("Local data/ip_ranges.json is a placeholder. Download the real Okta IP ranges JSON before testing.");
  }

  const lastModified = cachedLastModified || await fetchLastModified();
  jsonStatus.textContent = lastModified
    ? `Local JSON loaded. Okta S3 Last-Modified: ${lastModified}. Refresh target: daily.`
    : "Local JSON loaded. Last-Modified header file not found. Refresh target: daily.";

  return cachedIpJson;
}

function findRangesForKey(ipJson, key) {
  if (ipJson[key]) return flattenRanges(ipJson[key]);

  const lowerKey = key.toLowerCase();
  const matchedKey = Object.keys(ipJson).find(k => k.toLowerCase() === lowerKey);
  if (matchedKey) return flattenRanges(ipJson[matchedKey]);

  throw new Error(`No IP ranges found for key "${key}".`);
}

function renderResults(cell, key, ranges) {
  currentRanges = [...new Set(ranges)].sort();
  currentKey = key;

  resultTitle.textContent = key;
  resultMeta.textContent = `Detected cell: ${String(cell).toUpperCase()} • ${currentRanges.length} ranges • Okta S3 Last-Modified: ${cachedLastModified || "not available"}`;
  ipOutput.textContent = currentRanges.join("\n");
  results.classList.remove("hidden");
}

async function lookupByCell(cellOrKey) {
  hideMessage();
  results.classList.add("hidden");

  const key = mapCellToIpRangeKey(cellOrKey);
  showMessage("Reading local Okta IP range JSON...");

  const ipJson = await fetchIpJson();
  const ranges = findRangesForKey(ipJson, key);

  hideMessage();
  renderResults(cellOrKey, key, ranges);
}

async function lookupTenant() {
  try {
    hideMessage();
    results.classList.add("hidden");

    const metadataUrl = normalizeTenantUrl(tenantInput.value);
    showMessage(`Checking tenant metadata: ${metadataUrl}`);

    const metadataResponse = await fetch(metadataUrl, { cache: "no-store" });
    if (!metadataResponse.ok) throw new Error(`Could not fetch tenant metadata. HTTP ${metadataResponse.status}`);

    const metadata = await metadataResponse.json();
    const cell = extractCellFromOrgMetadata(metadata);

    await lookupByCell(cell);
  } catch (error) {
    showMessage(`${error.message} If this is a browser/CORS issue, use Manual fallback with a cell like OK14, EU1, OP3, us_cell_14, emea_cell_1, or preview_cell_3.`, true);
  }
}

lookupBtn.addEventListener("click", lookupTenant);

manualBtn.addEventListener("click", async () => {
  try {
    await lookupByCell(manualCell.value);
  } catch (error) {
    showMessage(error.message, true);
  }
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(currentRanges.join("\n"));
  copyBtn.textContent = "Copied";
  setTimeout(() => (copyBtn.textContent = "Copy IPs"), 1200);
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([currentRanges.join("\n") + "\n"], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentKey || "okta-ip-ranges"}.txt`;
  link.click();
  URL.revokeObjectURL(url);
});

tenantInput.addEventListener("keydown", event => {
  if (event.key === "Enter") lookupTenant();
});

renderMappingTable();
fetchLastModified().finally(() => {
  fetchIpJson().catch(error => {
    jsonStatus.textContent = error.message;
  });
});
