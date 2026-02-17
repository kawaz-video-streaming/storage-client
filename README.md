# @kawaz/storage-client

AWS S3 storage client library for Kawaz services with support for multipart uploads and bucket management.

## Installation

```bash
npm install @kawaz/storage-client
```

## Usage

### Initialize StorageClient

```typescript
import { StorageClient } from '@kawaz/storage-client';
import { Readable } from 'stream';

const client = new StorageClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'YOUR_ACCESS_KEY',
    secretAccessKey: 'YOUR_SECRET_KEY'
  },
  partSize: 5 * 1024 * 1024,      // 5MB (optional, default varies)
  maxConcurrency: 4                // Maximum concurrent parts (optional)
});
```

### Ensure Bucket Exists

Checks if a bucket exists, creates it if not.

```typescript
await client.ensureBucket('my-bucket');
```

### Upload Objects

Upload files or streams to S3 with optional automatic bucket creation:

```typescript
const fileStream = fs.createReadStream('path/to/file');

await client.uploadObject('my-bucket', 'path/to/object', fileStream, {
  ensureBucket: true  // Automatically create bucket if it doesn't exist
});
```

The upload progress is logged to console as it progresses.

### Delete Bucket

Remove an empty bucket:

```typescript
await client.deleteBucket('my-bucket');
```

## Configuration

`StorageClientConfig` extends AWS S3ClientConfig with additional options:

- `region` (required): AWS region (e.g., 'us-east-1')
- `credentials` (optional): AWS credentials object with `accessKeyId` and `secretAccessKey`
- `endpoint` (optional): Custom S3-compatible endpoint (e.g., MinIO, LocalStack)
- `partSize` (optional): Size of each part in multipart uploads (bytes)
- `maxConcurrency` (optional): Maximum concurrent parts during upload

## Error Handling

The library throws `StorageError` exceptions with operation details:

```typescript
import { StorageError } from '@kawaz/storage-client';

try {
  await client.uploadObject('bucket', 'key', stream);
} catch (error) {
  if (error instanceof StorageError) {
    console.error('Storage operation failed:', error.message);
  }
}
```

## Exports

- `StorageClient`: Main client class
- `StorageClientConfig`: Configuration interface
- `StorageError`: Error class
- `UploadObjectOptions`: Upload options interface

## License

MIT
