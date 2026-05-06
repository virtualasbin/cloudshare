const uploadForm = document.getElementById("uploadForm");
const updateForm = document.getElementById("updateForm");
const refreshButton = document.getElementById("refreshAssets");
const assetList = document.getElementById("assetList");
const logOutput = document.getElementById("logOutput");
const emptyState = document.getElementById("emptyState");
const searchAssetsInput = document.getElementById("searchAssets");
const filterTypeSelect = document.getElementById("filterType");
const selectedFileText = document.getElementById("selectedFileText");
const connectionStatus = document.getElementById("connectionStatus");
const clearLogButton = document.getElementById("clearLog");
const uploadButton = document.getElementById("uploadButton");
const updateButton = document.getElementById("updateButton");
const statTotal = document.getElementById("statTotal");
const statImages = document.getElementById("statImages");
const statVideos = document.getElementById("statVideos");
const statOther = document.getElementById("statOther");

const LOGIC_APP_PRESET =
  "https://prod-05.francecentral.logic.azure.com:443/workflows/0a72ffe9b8ea4a6da70632a1b94d677b/triggers/manual/paths/invoke?api-version=2019-05-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=oDsx8V2T9ubeU8b0-DMPaMqgeY76Z8Mt3k-6BeUSqzY";
const API_BASE_URL = LOGIC_APP_PRESET;

let allAssets = [];

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
  connectionStatus.dataset.status = status;
  connectionStatus.textContent = message;
}

function setButtonBusy(button, busy, busyText, idleText) {
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

function classifyAsset(contentType) {
  const type = String(contentType || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "other";
}

function ensureApiBase() {
  const value = API_BASE_URL;
  if (!value) {
    throw new Error("API base URL is not configured");
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

function getFilteredAssets() {
  const searchText = searchAssetsInput.value.trim().toLowerCase();
  const filterType = filterTypeSelect.value;
  return allAssets.filter((asset) => {
    const type = classifyAsset(asset.contentType);
    if (filterType !== "all" && type !== filterType) {
      return false;
    }
    if (!searchText) {
      return true;
    }
    const haystack = `${asset.name || ""} ${asset.id || ""} ${(asset.tags || []).join(" ")}`.toLowerCase();
    return haystack.includes(searchText);
  });
}

function updateStats(assets) {
  const total = assets.length;
  const images = assets.filter((asset) => classifyAsset(asset.contentType) === "image").length;
  const videos = assets.filter((asset) => classifyAsset(asset.contentType) === "video").length;
  const other = total - images - videos;
  statTotal.textContent = String(total);
  statImages.textContent = String(images);
  statVideos.textContent = String(videos);
  statOther.textContent = String(other);
}

async function sendApiRequest({ method, id, payload }) {
  const base = ensureApiBase();
  if (isLogicAppUrl(base)) {
    const body = { method, payload, assetId: id };
    return fetch(buildAssetUrl(base, id), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  const requestInit = { method };
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
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderAssets(assets) {
  assetList.innerHTML = "";
  emptyState.style.display = assets.length === 0 ? "block" : "none";

  assets.forEach((asset) => {
    const item = document.createElement("li");
    item.className = "asset-item";
    const tags = Array.isArray(asset.tags) ? asset.tags : [];
    const tagsHtml =
      tags.length > 0 ? tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("") : '<span class="tag">No tags</span>';

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
        <button class="button-secondary" data-action="edit" data-id="${escapeHtml(asset.id || "")}">Edit</button>
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
  allAssets = Array.isArray(data) ? data : [];
  updateStats(allAssets);
  renderAssets(getFilteredAssets());
  setConnectionStatus("ok", "Connected");
  log(`Loaded ${allAssets.length} assets`);
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
    setButtonBusy(uploadButton, true, "Uploading...", "Upload To Library");
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
    selectedFileText.textContent = file.name;
    const fileBase64 = await readFileAsBase64(file);
    await uploadAsset({ name, contentType, fileBase64, tags });
    uploadForm.reset();
    selectedFileText.textContent = "No file selected";
  } catch (error) {
    setConnectionStatus("error", "Operation Failed");
    log(getErrorMessage(error));
  } finally {
    setButtonBusy(uploadButton, false, "Uploading...", "Upload To Library");
  }
});

updateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setButtonBusy(updateButton, true, "Saving...", "Save Changes");
    const id = document.getElementById("updateAssetId").value.trim();
    const name = document.getElementById("updateAssetName").value.trim();
    const contentType = document.getElementById("updateAssetType").value.trim();
    const tagsRaw = document.getElementById("updateAssetTags").value.trim();
    const payload = {};
    if (name) payload.name = name;
    if (contentType) payload.contentType = contentType;
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
    setButtonBusy(updateButton, false, "Saving...", "Save Changes");
  }
});

assetList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const id = target.dataset.id;
  if (!id) return;

  if (target.dataset.action === "edit") {
    const asset = allAssets.find((item) => item.id === id);
    if (!asset) return;
    document.getElementById("updateAssetId").value = asset.id || "";
    document.getElementById("updateAssetName").value = asset.name || "";
    document.getElementById("updateAssetType").value = asset.contentType || "";
    document.getElementById("updateAssetTags").value = Array.isArray(asset.tags) ? asset.tags.join(", ") : "";
    log(`Selected ${id} for editing.`);
    return;
  }

  if (target.dataset.action !== "delete") return;

  try {
    await deleteAsset(id);
  } catch (error) {
    setConnectionStatus("error", "Operation Failed");
    log(getErrorMessage(error));
  }
});

searchAssetsInput.addEventListener("input", () => {
  renderAssets(getFilteredAssets());
});

filterTypeSelect.addEventListener("change", () => {
  renderAssets(getFilteredAssets());
});

clearLogButton.addEventListener("click", () => {
  logOutput.textContent = "";
});

document.getElementById("assetFile").addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  selectedFileText.textContent = input.files && input.files[0] ? input.files[0].name : "No file selected";
});

if (API_BASE_URL) {
  setConnectionStatus("idle", "Auto Configured");
  log("API auto-configured and connected via Azure Logic App.");
  fetchAssets().catch((error) => {
    setConnectionStatus("error", "Connection Failed");
    log(getErrorMessage(error));
  });
}
