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
  "https://prod-01.francecentral.logic.azure.com:443/workflows/95aae4a30eb141e985bd2c62e31aef68/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=AEIp26i5qpWf63OFeJgISaiygdVUOm4iYPOC9auen1g";
const FUNCTION_API_FALLBACK = "https://cloudshareapiasbin2.azurewebsites.net/api/assets";
const CREATE_API_URL =
  "https://prod-24.francecentral.logic.azure.com:443/workflows/60147b33bee94f3fa37eba55a37c1e82/triggers/manual/paths/invoke?api-version=2019-05-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=nHsCKN75ZhuYuIzs7hwFJnuaBNxNoXUc9sFZ2v7Bg00";
const DELETE_API_URL =
  "https://prod-23.francecentral.logic.azure.com:443/workflows/9dc848d9327940539f8df0634e492f3a/triggers/manual/paths/invoke?api-version=2019-05-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=HUBeLoVeTZrnRe9qzJbdHyeO07z0abfr3t9A2GitDXA";
const API_BASE_URL = FUNCTION_API_FALLBACK;
const SECONDARY_API_BASE_URL = LOGIC_APP_PRESET;
const PREVIEW_CACHE_KEY = "cloudshare.previewCache.v1";

let allAssets = [];

function getPreviewCache() {
  try {
    const raw = localStorage.getItem(PREVIEW_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setPreviewCache(cache) {
  try {
    localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

function savePreviewForAsset(assetId, previewDataUrl) {
  if (!assetId || !previewDataUrl) return;
  const cache = getPreviewCache();
  cache[assetId] = previewDataUrl;
  setPreviewCache(cache);
}

function removePreviewForAsset(assetId) {
  if (!assetId) return;
  const cache = getPreviewCache();
  if (Object.prototype.hasOwnProperty.call(cache, assetId)) {
    delete cache[assetId];
    setPreviewCache(cache);
  }
}

function applyPreviewCache(assets) {
  const cache = getPreviewCache();
  return assets.map((asset) => {
    if (asset.previewDataUrl) return asset;
    const cachedPreview = cache[asset.id];
    return cachedPreview ? { ...asset, previewDataUrl: cachedPreview } : asset;
  });
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

function isLikelyImageAsset(asset) {
  const type = String(asset?.contentType || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const hint = `${asset?.name || ""} ${asset?.blobUrl || ""}`.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(hint);
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
  const primary = ensureApiBase();
  const candidates = [primary, SECONDARY_API_BASE_URL].filter((value, index, arr) => value && arr.indexOf(value) === index);
  const retryStatuses = new Set([408, 429, 500, 502, 503, 504]);
  let lastError;

  for (let index = 0; index < candidates.length; index += 1) {
    const base = candidates[index];
    const hasFallback = index < candidates.length - 1;
    try {
      if (isLogicAppUrl(base)) {
        const body = { method, payload, assetId: id };
        const response = await fetch(buildAssetUrl(base, id), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        if (hasFallback && !response.ok) {
          log(`Primary endpoint returned ${response.status}. Retrying via fallback API...`);
          continue;
        }
        return response;
      }

      const requestInit = { method };
      if (payload !== undefined) {
        requestInit.headers = { "content-type": "application/json" };
        requestInit.body = JSON.stringify(payload);
      }
      const response = await fetch(buildAssetUrl(base, id), requestInit);
      if (hasFallback && retryStatuses.has(response.status)) {
          log(`Primary endpoint returned ${response.status}. Retrying via fallback API...`);
          continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (hasFallback) {
        log(`Primary endpoint request failed. Retrying via fallback API...`);
        continue;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("No API endpoint available");
}

async function sendCreateRequest(payload) {
  const candidates = [CREATE_API_URL, FUNCTION_API_FALLBACK].filter((value, index, arr) => value && arr.indexOf(value) === index);
  let lastError;

  for (let index = 0; index < candidates.length; index += 1) {
    const endpoint = candidates[index];
    const hasFallback = index < candidates.length - 1;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (hasFallback && !response.ok) {
        log(`Create endpoint returned ${response.status}. Retrying via fallback API...`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (hasFallback) {
        log("Create endpoint request failed. Retrying via fallback API...");
        continue;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("No create endpoint available");
}

async function sendDeleteRequest(id) {
  const candidates = [DELETE_API_URL, FUNCTION_API_FALLBACK].filter((value, index, arr) => value && arr.indexOf(value) === index);
  let lastError;

  for (let index = 0; index < candidates.length; index += 1) {
    const endpoint = candidates[index];
    const hasFallback = index < candidates.length - 1;
    try {
      let response;
      if (isLogicAppUrl(endpoint)) {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assetId: id })
        });
      } else {
        response = await fetch(buildAssetUrl(endpoint, id), { method: "DELETE" });
      }
      if (hasFallback && !response.ok) {
        log(`Delete endpoint returned ${response.status}. Retrying via fallback API...`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (hasFallback) {
        log("Delete endpoint request failed. Retrying via fallback API...");
        continue;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("No delete endpoint available");
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
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
    const type = classifyAsset(asset.contentType);
    const previewSrc = asset.previewDataUrl || asset.blobUrl || "";
    const previewHtml =
      isLikelyImageAsset(asset) && previewSrc
        ? `<img class="asset-preview" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(asset.name || "Asset preview")}" loading="lazy" onerror="this.style.display='none'" />`
        : "";

    item.innerHTML = `
      <div class="asset-title-row">
        <h3 class="asset-title">${escapeHtml(asset.name || "Untitled Asset")}</h3>
      </div>
      ${previewHtml}
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
  allAssets = applyPreviewCache(Array.isArray(data) ? data : []);
  updateStats(allAssets);
  renderAssets(getFilteredAssets());
  setConnectionStatus("ok", "Connected");
  log(`Loaded ${allAssets.length} assets`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAssetsWithRetry(maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fetchAssets();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        setConnectionStatus("idle", `Reconnecting (${attempt}/${maxAttempts - 1})...`);
        await sleep(900);
      }
    }
  }
  throw lastError;
}

async function uploadAsset(formData) {
  const response = await sendCreateRequest(formData);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }
  const created = await response.json();
  const createdWithPreview = { ...created, previewDataUrl: formData.previewDataUrl || "" };
  savePreviewForAsset(created.id, formData.previewDataUrl || "");
  log(`Uploaded asset ${created.id}`);
  allAssets = [createdWithPreview, ...allAssets.filter((asset) => asset.id !== created.id)];
  updateStats(allAssets);
  renderAssets(getFilteredAssets());
  setConnectionStatus("ok", "Connected");
  try {
    await fetchAssetsWithRetry(3);
  } catch {
    log("Upload succeeded; refresh delayed, showing local preview.");
  }
}

async function deleteAsset(id) {
  const response = await sendDeleteRequest(id);
  const successStatuses = new Set([200, 202, 204, 404]);
  if (!successStatuses.has(response.status)) {
    let confirmedDeleted = false;
    try {
      await fetchAssetsWithRetry(2);
      confirmedDeleted = !allAssets.some((asset) => asset.id === id);
    } catch {
      confirmedDeleted = false;
    }

    if (!confirmedDeleted) {
      let responseText = "";
      try {
        responseText = await response.text();
      } catch {
        responseText = "";
      }
      throw new Error(`Delete failed: ${response.status}${responseText ? ` ${responseText}` : ""}`);
    }
  }
  allAssets = allAssets.filter((asset) => asset.id !== id);
  removePreviewForAsset(id);
  updateStats(allAssets);
  renderAssets(getFilteredAssets());
  setConnectionStatus("ok", "Connected");
  log(`Deleted asset ${id}`);
  fetchAssetsWithRetry(3).catch(() => {
    log("Delete applied; refresh delayed.");
  });
}

async function updateAsset(id, payload) {
  const response = await sendApiRequest({ method: "PUT", id, payload });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update failed: ${response.status} ${text}`);
  }
  const updated = await response.json();
  allAssets = allAssets.map((asset) => (asset.id === id ? { ...asset, ...updated } : asset));
  updateStats(allAssets);
  renderAssets(getFilteredAssets());
  setConnectionStatus("ok", "Connected");
  log(`Updated asset ${updated.id}`);
  fetchAssetsWithRetry(3).catch(() => {
    log("Update applied; refresh delayed.");
  });
}

refreshButton.addEventListener("click", async () => {
  try {
    setButtonBusy(refreshButton, true, "Refreshing...", "Refresh");
    await fetchAssetsWithRetry();
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
    const fileDataUrl = await readFileAsDataUrl(file);
    const fileBase64 = fileDataUrl.split(",")[1] || "";
    await uploadAsset({ name, contentType, fileBase64, tags, previewDataUrl: fileDataUrl });
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
  log("API auto-configured with Azure Function primary and Logic App backup.");
  fetchAssetsWithRetry().catch((error) => {
    setConnectionStatus("error", "Connection Failed");
    log(getErrorMessage(error));
  });
}
