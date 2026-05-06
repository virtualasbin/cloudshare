const apiBaseInput = document.getElementById("apiBaseUrl");
const saveApiUrlButton = document.getElementById("saveApiUrl");
const uploadForm = document.getElementById("uploadForm");
const updateForm = document.getElementById("updateForm");
const refreshButton = document.getElementById("refreshAssets");
const assetList = document.getElementById("assetList");
const logOutput = document.getElementById("logOutput");

function getApiBaseUrl() {
  return localStorage.getItem("cloudshare-api-base-url") || "";
}

function setApiBaseUrl(url) {
  localStorage.setItem("cloudshare-api-base-url", url);
}

function log(message) {
  const timestamp = new Date().toISOString();
  logOutput.textContent = `[${timestamp}] ${message}\n${logOutput.textContent}`;
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
  assets.forEach((asset) => {
    const item = document.createElement("li");
    item.className = "asset-item";
    const tags = Array.isArray(asset.tags) ? asset.tags.join(", ") : "";
    item.innerHTML = `
      <strong>${asset.name}</strong>
      <span>ID: ${asset.id}</span>
      <span>Type: ${asset.contentType}</span>
      <span>Size: ${asset.size} bytes</span>
      <span>Tags: ${tags}</span>
      <a href="${asset.blobUrl}" target="_blank" rel="noreferrer">Open Blob</a>
      <div class="asset-actions">
        <button data-action="delete" data-id="${asset.id}">Delete</button>
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

saveApiUrlButton.addEventListener("click", () => {
  const url = apiBaseInput.value.trim().replace(/\/+$/, "");
  setApiBaseUrl(url);
  log("Saved API base URL");
});

refreshButton.addEventListener("click", async () => {
  try {
    await fetchAssets();
  } catch (error) {
    log(error.message);
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
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
    log(error.message);
  }
});

updateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
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
    log(error.message);
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
    log(error.message);
  }
});

apiBaseInput.value = getApiBaseUrl();
