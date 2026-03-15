# @ido_kawaz/storage-client

Storage client library for S3-compatible object storage (AWS S3, MinIO, LocalStack) with multipart upload support.

## Installation

```bash
npm install @ido_kawaz/storage-client
```

## Quick Start

```typescript
import { StorageClient } from '@ido_kawaz/storage-client';
import fs from 'node:fs';

const client = new StorageClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  partSize: 5 * 1024 * 1024,
  maxConcurrency: 4,
  batchSize: 10
});

await client.uploadObject(
  'my-bucket',
  { key: 'files/report.pdf', data: fs.createReadStream('./report.pdf') },
  { ensureBucket: true }
);
```

## API

### `createStorageClientConfig(): StorageClientConfig`

Builds a validated `StorageClientConfig` from environment variables using Zod.

Supported environment variables:

- `AWS_ENDPOINT` (required) - S3 endpoint URL
- `AWS_REGION` (optional, default `us-east-1`)
- `AWS_ACCESS_KEY_ID` (required)
- `AWS_SECRET_ACCESS_KEY` (required)
- `AWS_PART_SIZE` (optional, default `5242880`)
- `AWS_MAX_CONCURRENCY` (optional, default `4`)
- `AWS_BATCH_SIZE` (optional, default `10`)

### `new StorageClient(config)`

Creates a new client.

`StorageClientConfig` extends AWS `S3ClientConfig` and includes:

- `partSize: number` - multipart upload part size in bytes
- `maxConcurrency: number` - number of parts uploaded in parallel
- `batchSize: number` - number of objects processed in parallel per batch

### `ensureBucket(bucketName: string): Promise<void>`

Checks whether a bucket exists and creates it when it is missing.

### `deleteBucket(bucketName: string): Promise<void>`

Deletes a bucket. If the bucket does not exist, the operation is treated as successful.

### `uploadObject(bucketName: string, object: StorageObject, options?: UploadObjectOptions): Promise<void>`

Uploads a single object to storage. `StorageObject` is `{ key: string; data: Readable }`.

- By default, uses a regular `PutObject` request.
- When multipart upload is enabled, upload progress is logged to the console.
- If `options?.ensureBucket` is `true`, the bucket is created automatically when missing.
- If `options?.multipartUpload` is `true`, upload is performed using multipart upload.

### `uploadObjects(bucketName: string, objects: StorageObject[], options?: UploadObjectOptions): Promise<void>`

Uploads multiple objects in parallel batches (controlled by `batchSize`).

`UploadObjectOptions`:

- `ensureBucket: boolean`
- `multipartUpload: boolean`

### `downloadObject(bucketName: string, objectKey: string): Promise<Readable>`

Downloads an object and returns its body as a Node.js `Readable` stream.

- Throws `StorageError` when the object retrieval fails.
- Throws `StorageError` when the storage service returns an empty body.

### `getPresignedUrl(bucketName: string, objectKey: string, expiresInSeconds: number): Promise<string>`

Generates a pre-signed URL for temporary read access to an object.

- `expiresInSeconds` — how long the URL remains valid.
- Throws `StorageError` on signing failure.

### `deleteObject(bucketName: string, objectKey: string): Promise<void>`

Deletes a single object from a bucket.

- Throws `StorageError` on failure.

### `clearPrefix(bucketName: string, prefix: string): Promise<void>`

Deletes all objects whose key starts with the given prefix.

- No-ops when the prefix matches no objects.
- Throws `StorageError` if listing objects fails.

## Error Handling

Storage operations can throw `StorageError` with operation context in the message.

```typescript
import { StorageError } from '@ido_kawaz/storage-client';

try {
  await client.uploadObject('my-bucket', { key: 'files/a.txt', data: fs.createReadStream('./a.txt') });
} catch (error) {
  if (error instanceof StorageError) {
    console.error(error.message);
  }
}
```

## Exports

- `StorageClient`
- `createStorageConfig`
- `StorageConfig`
- `StorageError`
- `StorageObject`
- `UploadObjectOptions`

## Development

```bash
npm run build
npm test
```

Useful test scripts:

- `npm test` - run tests once

## License

MIT
