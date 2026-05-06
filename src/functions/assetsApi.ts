import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { v4 as uuidv4 } from "uuid";
import { ZodError } from "zod";
import type { AssetRecord, CreateAssetRequest, UpdateAssetRequest } from "../models/asset.js";
import { BadRequestError, createAssetSchema, jsonResponse, normalizePath, updateAssetSchema } from "../lib/http.js";
import { BlobStorageService } from "../services/blobStorage.js";
import { AssetRepository } from "../services/assetRepository.js";

let blobService: BlobStorageService | undefined;
let repository: AssetRepository | undefined;
let initialized = false;

async function initializeServices(): Promise<void> {
  if (initialized) {
    return;
  }
  blobService = new BlobStorageService();
  repository = new AssetRepository();
  await blobService.ensureContainer();
  await repository.initialize();
  initialized = true;
}

async function parseJson<T>(request: HttpRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new BadRequestError("Invalid JSON payload");
  }
}

function toBase64Buffer(fileBase64: string): Buffer {
  try {
    const bytes = Buffer.from(fileBase64, "base64");
    if (bytes.byteLength === 0) {
      throw new Error("Empty content");
    }
    return bytes;
  } catch {
    throw new BadRequestError("Invalid fileBase64 payload");
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function attachReadableUrl(record: AssetRecord): AssetRecord {
  if (!blobService) {
    return record;
  }
  return {
    ...record,
    blobUrl: blobService.getReadUrl(record.blobPath)
  };
}

async function createAsset(payload: CreateAssetRequest): Promise<AssetRecord> {
  if (!blobService || !repository) {
    throw new Error("Services not initialized");
  }
  const id = uuidv4();
  const bytes = toBase64Buffer(payload.fileBase64);
  const blobPath = `${id}-${payload.name}`;
  const blobUrl = await blobService.upload(blobPath, bytes, payload.contentType);
  const timestamp = nowIso();
  const record: AssetRecord = {
    id,
    name: payload.name,
    contentType: payload.contentType,
    size: bytes.byteLength,
    blobPath,
    blobUrl,
    tags: payload.tags ?? [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
  return repository.create(record);
}

async function updateAsset(existing: AssetRecord, payload: UpdateAssetRequest): Promise<AssetRecord> {
  if (!blobService || !repository) {
    throw new Error("Services not initialized");
  }
  let blobPath = existing.blobPath;
  let blobUrl = existing.blobUrl;
  let size = existing.size;
  let contentType = payload.contentType ?? existing.contentType;

  if (payload.fileBase64) {
    const bytes = toBase64Buffer(payload.fileBase64);
    blobPath = `${existing.id}-${payload.name ?? existing.name}`;
    blobUrl = await blobService.upload(blobPath, bytes, contentType);
    size = bytes.byteLength;
  }

  const updated: AssetRecord = {
    ...existing,
    name: payload.name ?? existing.name,
    contentType,
    size,
    blobPath,
    blobUrl,
    tags: payload.tags ?? existing.tags,
    updatedAt: nowIso()
  };

  return repository.update(updated);
}

async function assetsApi(request: HttpRequest, _context: InvocationContext): Promise<Response> {
  try {
    await initializeServices();
    if (!blobService || !repository) {
      throw new Error("Services not initialized");
    }
    const segments = normalizePath(request.params.path ?? "");

    if (request.method === "GET" && segments.length === 0) {
      const list = await repository.list();
      return jsonResponse(200, list.map(attachReadableUrl));
    }

    if (request.method === "POST" && segments.length === 0) {
      const body = await parseJson<CreateAssetRequest>(request);
      const payload = createAssetSchema.parse(body);
      const created = await createAsset(payload);
      return jsonResponse(201, attachReadableUrl(created));
    }

    if (segments.length === 1) {
      const [id] = segments;
      const existing = await repository.get(id);
      if (!existing) {
        return jsonResponse(404, { message: "Asset not found" });
      }

      if (request.method === "GET") {
        return jsonResponse(200, attachReadableUrl(existing));
      }

      if (request.method === "PUT") {
        const body = await parseJson<UpdateAssetRequest>(request);
        const payload = updateAssetSchema.parse(body);
        const updated = await updateAsset(existing, payload);
        return jsonResponse(200, attachReadableUrl(updated));
      }

      if (request.method === "DELETE") {
        await blobService.delete(existing.blobPath);
        await repository.delete(id);
        return jsonResponse(204, {});
      }
    }

    return jsonResponse(405, { message: "Method or route not supported" });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return jsonResponse(400, { message: error.message });
    }
    if (error instanceof ZodError) {
      return jsonResponse(400, {
        message: "Validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { message });
  }
}

app.http("assetsApi", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  route: "assets/{*path}",
  authLevel: "anonymous",
  handler: assetsApi
});
