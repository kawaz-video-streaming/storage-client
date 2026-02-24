import { S3ClientConfig } from "@aws-sdk/client-s3";

export interface StorageClientConfig extends S3ClientConfig {
    partSize: number; // Optional configuration for multipart upload part size
    maxConcurrency: number; // Optional configuration for maximum concurrency in multipart uploads
}

export class StorageError extends Error {
    constructor(operation: string, error: Error, details: {}) {
        const message = `Storage error: ${JSON.stringify({ operation, error: error.message, ...details })}`;
        super(message);
    }
}

export interface UploadObjectOptions {
    ensureBucket: boolean;
}