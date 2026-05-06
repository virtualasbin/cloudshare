export interface AssetRecord {
  id: string;
  name: string;
  contentType: string;
  size: number;
  blobPath: string;
  blobUrl: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetRequest {
  name: string;
  contentType: string;
  fileBase64: string;
  tags?: string[];
}

export interface UpdateAssetRequest {
  name?: string;
  contentType?: string;
  fileBase64?: string;
  tags?: string[];
}
