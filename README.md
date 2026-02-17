# @kawaz/storage-client

Storage client library for Kawaz services integrating with AWS S3.

## Installation

### From NPM/Artifactory

```bash
npm install @kawaz/storage-client
```

### Local Development with Symlink

1. Build the library:
```bash
cd libraries/storage-client
npm install
npm run build
```

2. Create a symlink in your service's node_modules:
```bash
# From your service directory
npm link ../../../libraries/storage-client
```

Or globally:
```bash
cd libraries/storage-client
npm link

# Then in your service
npm link @kawaz/storage-client
```

## Usage

```typescript
import { StorageClient } from '@kawaz/storage-client';
import { Readable } from 'stream';

const client = new StorageClient({
  region: 'us-east-1',
  bucket: 'my-bucket',
  // Optional: for local/custom S3
  endpoint: 'http://localhost:9000',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
});

// Upload a file
await client.uploadFile('path/to/file', Buffer.from('content'));

// Download a file
const stream = await client.downloadFile('path/to/file');

// Check if file exists
const exists = await client.fileExists('path/to/file');

// Close connection
await client.close();
```

## Publishing to Artifactory

1. Update the version in `package.json`:
```bash
npm version patch  # or minor/major
```

2. Build the library:
```bash
npm run build
```

3. Configure your npm credentials for Artifactory:
```bash
npm config set registry https://your-artifactory-url/artifactory/api/npm/npm
npm config set @kawaz:registry https://your-artifactory-url/artifactory/api/npm/npm
npm login
```

4. Publish:
```bash
npm publish
```

## Configuration

The `StorageClient` accepts the following configuration:

- `region` (required): AWS region
- `bucket` (required): S3 bucket name
- `endpoint` (optional): Custom S3 endpoint (useful for MinIO or local testing)
- `accessKeyId` (optional): AWS access key ID
- `secretAccessKey` (optional): AWS secret access key

## License

MIT
