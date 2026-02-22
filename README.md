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
  maxConcurrency: 4
});

await client.uploadObject(
  'my-bucket',
  'files/report.pdf',
  fs.createReadStream('./report.pdf'),
  { ensureBucket: true }
);
```

## API

### `new StorageClient(config)`

Creates a new client.

`StorageClientConfig` extends AWS `S3ClientConfig` and includes:

- `partSize: number` - multipart upload part size in bytes
- `maxConcurrency: number` - number of parts uploaded in parallel

### `ensureBucket(bucketName: string): Promise<void>`

Checks whether a bucket exists and creates it when it is missing.

### `deleteBucket(bucketName: string): Promise<void>`

Deletes a bucket. If the bucket does not exist, the operation is treated as successful.

### `uploadObject(bucketName: string, objectKey: string, objectData: Readable, options?: UploadObjectOptions): Promise<void>`

Uploads a stream to object storage using multipart upload.

- `objectData` must be a Node.js `Readable` stream.
- Upload progress is logged to the console.
- If `options?.ensureBucket` is `true`, the bucket is created automatically when missing.

`UploadObjectOptions`:

- `ensureBucket: boolean`

## Error Handling

Storage operations can throw `StorageError` with operation context in the message.

```typescript
import { StorageError } from '@ido_kawaz/storage-client';

try {
  await client.uploadObject('my-bucket', 'files/a.txt', fs.createReadStream('./a.txt'));
} catch (error) {
  if (error instanceof StorageError) {
    console.error(error.message);
  }
}
```

## Exports

- `StorageClient`
- `StorageClientConfig`
- `StorageError`
- `UploadObjectOptions`

## Development

```bash
npm run build
npm test
```

Useful test scripts:

- `npm test` - run tests once
- `npm run test:watch` - run tests in watch mode
- `npm run test:coverage` - run tests with coverage report

## License

MIT
