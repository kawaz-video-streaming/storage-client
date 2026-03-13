# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Clean dist and compile TypeScript
npm run build:watch    # Watch mode compilation
npm test               # Build then run all tests
npm run clean          # Remove dist/
npm run package        # Full clean build + test + publish to npm
```

Run a single test file:
```bash
npx jest src/__tests__/config.test.ts --runInBand
```

## Architecture

This is a TypeScript npm library (`@ido_kawaz/storage-client`) that wraps the AWS S3 SDK for use in Kawaz Plus services.

**Entry point:** `src/index.ts` re-exports three public APIs:
- `StorageClient` — main class wrapping `S3Client` with `ensureBucket`, `deleteBucket`, `clearPrefix`, `uploadObject`, `downloadObject`, `getPresignedUrl`, `deleteObject`
- `createStorageConfig` — reads S3 config from environment variables (validated with Zod), returns a `StorageConfig`
- `StorageError`, `UploadObjectOptions` — types

**Config (`src/config.ts`):** `createStorageConfig()` parses these env vars via Zod:
- `AWS_ENDPOINT` (required URL), `AWS_REGION` (default: `us-east-1`)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (required)
- `AWS_PART_SIZE` (default: 5MB), `AWS_MAX_CONCURRENCY` (default: 4)

**`uploadObject`** supports two modes via `UploadObjectOptions`:
- Default: `PutObjectCommand` (single upload)
- `multipartUpload: true`: uses `@aws-sdk/lib-storage` `Upload` with configurable part size and concurrency

**Build output:** `dist/` (gitignored), published as the package's `main`/`types`.
