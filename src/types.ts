import { Readable } from "stream";

export class StorageError extends Error {
    constructor(operation: string, error: Error, details: {}) {
        const message = `Storage error: ${JSON.stringify({ operation, error: error.message, ...details })}`;
        super(message);
    }
}

export interface StorageObject {
    key: string;
    data: Readable | (() => Readable);
}

export interface UploadObjectOptions {
    ensureBucket?: boolean;
    multipartUpload?: boolean; // Optional flag to indicate if multipart upload should be used
}

export type OnProgressCallback = (index: number, total: number) => void | Promise<void>;