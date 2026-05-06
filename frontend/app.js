const apiBaseInput = document.getElementById("apiBaseUrl");
const saveApiUrlButton = document.getElementById("saveApiUrl");
const uploadForm = document.getElementById("uploadForm");
const updateForm = document.getElementById("updateForm");
const refreshButton = document.getElementById("refreshAssets");
const assetList = document.getElementById("assetList");
const logOutput = document.getElementById("logOutput");
const emptyState = document.getElementById("emptyState");
const connectionStatus = document.getElementById("connectionStatus");
const testConnectionButton = document.getElementById("testConnection");
const clearLogButton = document.getElementById("clearLog");
const uploadButton = document.getElementById("uploadButton");
const updateButton = document.getElementById("updateButton");
const useFunctionApiButton = document.getElementById("useFunctionApi");
const useLogicAppButton = document.getElementById("useLogicApp");

const API_STORAGE_KEY = "cloudshare-api-base-url";
const FUNCTION_API_PRESET = "https://cloudshareapiasbin2.azurewebsites.net/api/assets";
const LOGIC_APP_PRESET =
  "https://prod-05.francecentral.logic.azure.com:443/workflows/0a72ffe9b8ea4a6da70632a1b94d677b/triggers/manual/paths/invoke?api-version=2019-05-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=oDsx8V2T9ubeU8b0-DMPaMqgeY76Z8Mt3k-6BeUSqzY";

function getStoredApiBaseUrl() {
  return localStorage.getItem(API_STORAGE_KEY) || "";
}

function getApiBaseUrl() {
  return getStoredApiBaseUrl() || FUNCTION_API_PRESET;
}

function setApiBaseUrl(url) {
  localStorage.setItem(API_STORAGE_KEY, url);
}

function log(message) {
  const timestamp = new Date().toISOString();
  logOutput.textContent = `[${timestamp}] ${message}\n${logOutput.textContent}`;
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function setConnectionStatus(status, message) {
  if (!connectionStatus) {
    return;
  }
  connectionStatus.dataset.status = status;
  connectionStatus.textContent = message;
}

function setButtonBusy(button, busy, busyText, idleText) {
  if (!button) {
    return;
  }
  button.disabled = busy;
  button.textContent = busy ? busyText : idleText;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) {
    return "N/A";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return date.toLocaleString();
}

function ensureApiBase() {
  const value = getApiBaseUrl();
  if (!value) {
    throw new Error("Set API Base URL first");
  }
  return value;
}

function isLogicAppUrl(url) {
  return url.includes(".logic.azure.com/");
}

function buildAssetUrl(base, id) {
  if (!id) {
    return base;
  }
  if (isLogicAppUrl(base)) {
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}assetId=${encodeURIComponent(id)}`;
  }
  return `${base}/${encodeURIComponent(id)}`;
}

async function sendApiRequest({ method, id, payload }) {
  const base = ensureApiBase();
  if (isLogicAppUrl(base)) {
    const body = {
      method,
      payload,
      assetId: id
    };
    return fetch(buildAssetUrl(base, id), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  const requestInit = {
    method
  };
  if (payload !== undefined) {
    requestInit.headers = { "content-type": "application/json" };
    requestInit.body = JSON.stringify(payload);
  }
  return fetch(buildAssetUrl(base, id), requestInit);
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderAssets(assets) {
  assetList.innerHTML = "";
  if (emptyState) {
    emptyState.style.display = assets.length === 0 ? "block" : "none";
  }

  assets.forEach((asset) => {
    const item = document.createElement("li");
    item.className = "asset-item";
    const tags = Array.isArray(asset.tags) ? asset.tags : [];
    const tagsHtml =
      tags.length > 0
        ? tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")
        : '<span class="tag">No tags</span>';

    item.innerHTML = `
      <div class="asset-title-row">
        <h3 class="asset-title">${escapeHtml(asset.name || "Untitled Asset")}</h3>
      </div>
      <div class="asset-meta">
        <span><strong>ID:</strong> <span class="asset-id">${escapeHtml(asset.id || "N/A")}</span></span>
        <span><strong>Type:</strong> ${escapeHtml(asset.contentType || "N/A")}</span>
        <span><strong>Size:</strong> ${formatBytes(asset.size)}</span>
        <span><strong>Updated:</strong> ${formatDate(asset.updatedAt || asset.createdAt)}</span>
      </div>
      <div class="tag-list">${tagsHtml}</div>
      <a class="asset-link" href="${escapeHtml(asset.blobUrl || "#")}" target="_blank" rel="noreferrer">Open Blob</a>
      <div class="asset-actions">
        <button class="danger" data-action="delete" data-id="${escapeHtml(asset.id || "")}">Delete</button>
      </div>
    `;
    assetList.appendChild(item);
  });
}

async function fetchAssets() {
  const response = await sendApiRequest({ method: "GET" });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }
  const data = await response.json();
  renderAssets(data);
  setConnectionStatus("ok", "Connected");
  log(`Loaded ${data.length} assets`);
}

async function uploadAsset(formData) {
  const response = await sendApiRequest({ method: "POST", payload: formData });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }
  const created = await response.json();
  log(`Uploaded asset ${created.id}`);
  await fetchAssets();
}

async function deleteAsset(id) {
  const response = await sendApiRequest({ method: "DELETE", id });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Delete failed: ${response.status}`);
  }
  log(`Deleted asset ${id}`);
  await fetchAssets();
}

async function updateAsset(id, payload) {
  const response = await sendApiRequest({ method: "PUT", id, payload });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update failed: ${response.status} ${text}`);
  }
  const updated = await response.json();
  log(`Updated asset ${updated.id}`);
  await fetchAssets();
}

function saveCurrentApiUrl() {
  const url = apiBaseInput.value.trim().replace(/\/+$/, "");
  if (!url) {
    setConnectionStatus("error", "URL Required");
    log("Please enter a valid API URL");
    return;
  }
  setApiBaseUrl(url);
  setConnectionStatus("idle", "Saved");
  log("Saved API base URL");
}

saveApiUrlButton.addEventListener("click", () => {
  saveCurrentApiUrl();
});

refreshButton.addEventListener("click", async () => {
  try {
    setButtonBusy(refreshButton, true, "Refreshing...", "Refresh");
    await fetchAssets();
  } catch (error) {
    setConnectionStatus("error", "Connection Failed");
    log(getErrorMessage(error));
  } finally {
    setButtonBusy(refreshButton, false, "Refreshing...", "Refresh");
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setButtonBusy(uploadButton, true, "Uploading...", "Upload Asset");
    const name = document.getElementById("assetName").value.trim();
    const contentType = document.getElementById("assetType").value.trim();
    const tags = document
      .getElementById("assetTags")
      .value.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const fileInput = document.getElementById("assetFile");
    if (!fileInput.files || fileInput.files.length === 0) {
      throw new Error("Select a file first");
    }
    const file = fileInput.files[0];
    const fileBase64 = await readFileAsBase64(file);
    await uploadAsset({ name, contentType, fileBase64, tags });
    uploadForm.reset();
  } catch (error) {
    setConnectionStatus("error", "Operation Failed");
    log(getErrorMessage(error));
  } finally {
    setButtonBusy(uploadButton, false, "Uploading...", "Upload Asset");
  }
});

updateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setButtonBusy(updateButton, true, "Updating...", "Update Metadata");
    const id = document.getElementById("updateAssetId").value.trim();
    const name = document.getElementById("updateAssetName").value.trim();
    const contentType = document.getElementById("updateAssetType").value.trim();
    const tagsRaw = document.getElementById("updateAssetTags").value.trim();
    const payload = {};
    if (name) {
      payload.name = name;
    }
    if (contentType) {
      payload.contentType = contentType;
    }
    if (tagsRaw) {
      payload.tags = tagsRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }
    if (Object.keys(payload).length === 0) {
      throw new Error("Provide at least one field to update");
    }
    await updateAsset(id, payload);
    updateForm.reset();
  } catch (error) {
    setConnectionStatus("error", "Operation Failed");
    log(getErrorMessage(error));
  } finally {
    setButtonBusy(updateButton, false, "Updating...", "Update Metadata");
  }
});

assetList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target.dataset.action !== "delete") {
    return;
  }
  const id = target.dataset.id;
  if (!id) {
    return;
  }
  try {
    await deleteAsset(id);
  } catch (error) {
    setConnectionStatus("error", "Operation Failed");
    log(getErrorMessage(error));
  }
});

const storedApiBase = getStoredApiBaseUrl();
if (!storedApiBase) {
  setApiBaseUrl(FUNCTION_API_PRESET);
  setConnectionStatus("idle", "Auto Configured");
  log("Auto-configured API URL for direct use from Live link.");
}
apiBaseInput.value = getApiBaseUrl();

testConnectionButton.addEventListener("click", async () => {
  try {
    setButtonBusy(testConnectionButton, true, "Testing...", "Test Connection");
    await fetchAssets();
  } catch (error) {
    setConnectionStatus("error", "Connection Failed");
    log(getErrorMessage(error));
  } finally {
    setButtonBusy(testConnectionButton, false, "Testing...", "Test Connection");
  }
});

clearLogButton.addEventListener("click", () => {
  logOutput.textContent = "";
});

useFunctionApiButton.addEventListener("click", () => {
  apiBaseInput.value = FUNCTION_API_PRESET;
  saveCurrentApiUrl();
});

useLogicAppButton.addEventListener("click", () => {
  apiBaseInput.value = LOGIC_APP_PRESET;
  saveCurrentApiUrl();
});

if (getApiBaseUrl()) {
  fetchAssets().catch((error) => {
    setConnectionStatus("error", "Connection Failed");
    log(getErrorMessage(error));
  });
}
