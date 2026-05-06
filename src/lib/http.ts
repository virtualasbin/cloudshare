import { z } from "zod";

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export const createAssetSchema = z.object({
  name: z.string().min(1),
  contentType: z.string().min(1),
  fileBase64: z.string().min(1),
  tags: z.array(z.string().min(1)).optional().default([])
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  fileBase64: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional()
});

export function normalizePath(path: string): string[] {
  return path
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
