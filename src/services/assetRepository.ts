import { CosmosClient } from "@azure/cosmos";
import type { AssetRecord } from "../models/asset.js";

export class AssetRepository {
  private readonly client: any;
  private readonly databaseName: string;
  private readonly containerName: string;
  private container?: any;

  constructor() {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint || !key) {
      throw new Error("Missing COSMOS_ENDPOINT or COSMOS_KEY");
    }
    this.databaseName = process.env.COSMOS_DATABASE ?? "cloudshare";
    this.containerName = process.env.COSMOS_CONTAINER ?? "assets";
    this.client = new CosmosClient({ endpoint, key });
  }

  async initialize(): Promise<void> {
    const { database } = await this.client.databases.createIfNotExists({
      id: this.databaseName
    });
    const { container } = await database.containers.createIfNotExists({
      id: this.containerName,
      partitionKey: {
        paths: ["/id"]
      }
    });
    this.container = container;
  }

  async create(record: AssetRecord): Promise<AssetRecord> {
    const container = this.getContainer();
    const { resource } = await container.items.create(record);
    if (!resource) {
      throw new Error("Failed to create record");
    }
    return resource as AssetRecord;
  }

  async list(): Promise<AssetRecord[]> {
    const container = this.getContainer();
    const queryResult = await container.items
      .query({
        query: "SELECT * FROM c ORDER BY c.createdAt DESC"
      })
      .fetchAll();
    return queryResult.resources;
  }

  async get(id: string): Promise<AssetRecord | null> {
    const container = this.getContainer();
    try {
      const { resource } = await container.item(id, id).read();
      return resource ?? null;
    } catch {
      return null;
    }
  }

  async update(record: AssetRecord): Promise<AssetRecord> {
    const container = this.getContainer();
    const { resource } = await container.item(record.id, record.id).replace(record);
    if (!resource) {
      throw new Error("Failed to update record");
    }
    return resource as AssetRecord;
  }

  async delete(id: string): Promise<void> {
    const container = this.getContainer();
    await container.item(id, id).delete();
  }

  private getContainer(): any {
    if (!this.container) {
      throw new Error("Repository not initialized");
    }
    return this.container;
  }
}
