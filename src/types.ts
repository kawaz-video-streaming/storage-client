export class StorageError extends Error {
    constructor(operation: string, error: Error, details: {}) {
        const message = `Storage error: ${JSON.stringify({ operation, error: error.message, ...details })}`;
        super(message);
    }
}

export interface UploadObjectOptions {
    ensureBucket?: boolean;
    multipartUpload?: boolean; // Optional flag to indicate if multipart upload should be used
}