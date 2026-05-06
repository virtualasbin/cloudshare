import { BlobServiceClient } from "@azure/storage-blob";

export class BlobStorageService {
  private readonly containerName: string;
  private readonly client: BlobServiceClient;

  constructor() {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("Missing STORAGE_CONNECTION_STRING");
    }
    this.containerName = process.env.STORAGE_CONTAINER ?? "assets";
    this.client = BlobServiceClient.fromConnectionString(connectionString);
  }

  async ensureContainer(): Promise<void> {
    const containerClient = this.client.getContainerClient(this.containerName);
    await containerClient.createIfNotExists();
  }

  async upload(blobPath: string, bytes: Buffer, contentType: string): Promise<string> {
    const containerClient = this.client.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    await blockBlobClient.uploadData(bytes, {
      blobHTTPHeaders: {
        blobContentType: contentType
      }
    });
    return blockBlobClient.url;
  }

  async delete(blobPath: string): Promise<void> {
    const containerClient = this.client.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    await blockBlobClient.deleteIfExists();
  }
}
