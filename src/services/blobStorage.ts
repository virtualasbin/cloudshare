import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";

export class BlobStorageService {
  private readonly containerName: string;
  private readonly client: BlobServiceClient;
  private readonly sharedKeyCredential: StorageSharedKeyCredential;

  constructor() {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("Missing STORAGE_CONNECTION_STRING");
    }
    const accountName = this.readConnectionStringValue(connectionString, "AccountName");
    const accountKey = this.readConnectionStringValue(connectionString, "AccountKey");
    if (!accountName || !accountKey) {
      throw new Error("STORAGE_CONNECTION_STRING must include AccountName and AccountKey");
    }
    this.containerName = process.env.STORAGE_CONTAINER ?? "assets";
    this.client = BlobServiceClient.fromConnectionString(connectionString);
    this.sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
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

  getReadUrl(blobPath: string, expiresInMinutes = 120): string {
    const containerClient = this.client.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: blobPath,
        permissions: BlobSASPermissions.parse("r"),
        startsOn,
        expiresOn,
        protocol: SASProtocol.Https
      },
      this.sharedKeyCredential
    ).toString();
    return `${blockBlobClient.url}?${sas}`;
  }

  private readConnectionStringValue(connectionString: string, key: string): string | undefined {
    const prefix = `${key}=`;
    const entry = connectionString.split(";").find((item) => item.startsWith(prefix));
    return entry?.slice(prefix.length);
  }
}
