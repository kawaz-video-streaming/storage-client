import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import { StorageClient } from '../storageClient';
import { StorageError } from '../types';

const sendMock = jest.fn<Promise<unknown>, [unknown]>();

jest.mock('@aws-sdk/client-s3', () => {
    class MockHeadBucketCommand {
        constructor(public readonly input: unknown) { }
    }

    class MockCreateBucketCommand {
        constructor(public readonly input: unknown) { }
    }

    class MockDeleteBucketCommand {
        constructor(public readonly input: unknown) { }
    }

    class MockGetObjectCommand {
        constructor(public readonly input: unknown) { }
    }

    class MockPutObjectCommand {
        constructor(public readonly input: unknown) { }
    }

    class MockDeleteObjectCommand {
        constructor(public readonly input: unknown) { }
    }

    class MockListObjectsCommand {
        constructor(public readonly input: unknown) { }
    }

    return {
        S3Client: jest.fn().mockImplementation(() => ({
            send: sendMock
        })),
        HeadBucketCommand: MockHeadBucketCommand,
        CreateBucketCommand: MockCreateBucketCommand,
        DeleteBucketCommand: MockDeleteBucketCommand,
        GetObjectCommand: MockGetObjectCommand,
        PutObjectCommand: MockPutObjectCommand,
        DeleteObjectCommand: MockDeleteObjectCommand,
        ListObjectsCommand: MockListObjectsCommand
    };
});

const uploadOnMock = jest.fn<void, [string, (...args: unknown[]) => void]>();
const uploadDoneMock = jest.fn<Promise<void>, []>();

const getSignedUrlMock = jest.fn<Promise<string>, [unknown, unknown, unknown]>();

jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: (a: unknown, b: unknown, c: unknown) => getSignedUrlMock(a, b, c)
}));

jest.mock('@aws-sdk/lib-storage', () => ({
    Upload: jest.fn().mockImplementation(() => ({
        on: uploadOnMock,
        done: uploadDoneMock
    }))
}));

describe('StorageClient', () => {
    const config = {
        region: 'us-east-1',
        partSize: 5 * 1024 * 1024,
        maxConcurrency: 4,
        batchSize: 10
    };

    beforeEach(() => {
        jest.clearAllMocks();
        sendMock.mockReset();
        uploadDoneMock.mockReset();
        uploadOnMock.mockReset();
        getSignedUrlMock.mockReset();
    });

    it('ensureBucket does nothing when bucket exists', async () => {
        sendMock.mockResolvedValueOnce({});
        const client = new StorageClient(config);

        await client.ensureBucket('existing-bucket');

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    });

    it('ensureBucket creates bucket when missing', async () => {
        sendMock
            .mockRejectedValueOnce({ name: 'NotFound' })
            .mockResolvedValueOnce({});

        const client = new StorageClient(config);

        await client.ensureBucket('new-bucket');

        expect(sendMock).toHaveBeenCalledTimes(2);
        expect(sendMock.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
        expect(sendMock.mock.calls[1][0]).toBeInstanceOf(CreateBucketCommand);
    });

    it('ensureBucket wraps non-NotFound errors', async () => {
        sendMock.mockRejectedValueOnce({ name: 'Forbidden' });
        const client = new StorageClient(config);

        await expect(client.ensureBucket('private-bucket')).rejects.toBeInstanceOf(StorageError);
    });

    it('deleteBucket ignores NoSuchBucket errors', async () => {
        sendMock.mockRejectedValueOnce({ name: 'NoSuchBucket' });
        const client = new StorageClient(config);

        await expect(client.deleteBucket('missing')).resolves.toBeUndefined();
        expect(sendMock.mock.calls[0][0]).toBeInstanceOf(DeleteBucketCommand);
    });

    it('deleteBucket wraps unexpected errors', async () => {
        sendMock.mockRejectedValueOnce({ name: 'AccessDenied' });
        const client = new StorageClient(config);

        await expect(client.deleteBucket('restricted')).rejects.toBeInstanceOf(StorageError);
    });

    it('uploadObject uses PutObject by default', async () => {
        sendMock.mockResolvedValueOnce({});
        const client = new StorageClient(config);
        const objectData = Readable.from(['hello']);

        await client.uploadObject('bucket-a', { key: 'path/file.txt', data: objectData });

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
        expect(Upload).not.toHaveBeenCalled();
    });

    it('uploadObject runs Upload with config and object params when multipart enabled', async () => {
        uploadDoneMock.mockResolvedValueOnce();
        const client = new StorageClient(config);
        const objectData = Readable.from(['hello']);

        await client.uploadObject('bucket-a', { key: 'path/file.txt', data: objectData }, { multipartUpload: true });

        expect(Upload).toHaveBeenCalledTimes(1);
        expect(Upload).toHaveBeenCalledWith(
            expect.objectContaining({
                params: expect.objectContaining({
                    Bucket: 'bucket-a',
                    Key: 'path/file.txt',
                    Body: objectData
                }),
                queueSize: config.maxConcurrency,
                partSize: config.partSize
            })
        );
        expect(uploadOnMock).toHaveBeenCalledWith('httpUploadProgress', expect.any(Function));
    });

    it('uploadObject calls ensureBucket when requested', async () => {
        uploadDoneMock.mockResolvedValueOnce();
        const client = new StorageClient(config);
        const ensureBucketSpy = jest.spyOn(client, 'ensureBucket').mockResolvedValue();

        await client.uploadObject('bucket-b', { key: 'file.txt', data: Readable.from(['x']) }, { ensureBucket: true });

        expect(ensureBucketSpy).toHaveBeenCalledWith('bucket-b');
    });

    it('uploadObject wraps upload failures in StorageError', async () => {
        uploadDoneMock.mockRejectedValueOnce(new Error('UploadDenied'));
        const client = new StorageClient(config);

        await expect(client.uploadObject('bucket-c', { key: 'file.txt', data: Readable.from(['x']) }, { multipartUpload: true })).rejects.toBeInstanceOf(StorageError);
    });

    it('uploadObject includes operation and context in wrapped error message', async () => {
        const error = new Error('unexpected');
        uploadDoneMock.mockRejectedValueOnce(error);
        const client = new StorageClient(config);

        await expect(client.uploadObject('bucket-d', { key: 'file.txt', data: Readable.from(['x']) }, { multipartUpload: true })).rejects.toThrow(
            'Storage error: {"operation":"uploadObject","error":"unexpected","Bucket":"bucket-d","Key":"file.txt"}'
        );
    });

    it('downloadObject returns readable stream body', async () => {
        const body = Readable.from(['hello']);
        sendMock.mockResolvedValueOnce({ Body: body });
        const client = new StorageClient(config);

        const result = await client.downloadObject('bucket-e', 'file.txt');

        expect(result).toBe(body);
        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    });

    it('downloadObject wraps get-object failures in StorageError', async () => {
        sendMock.mockRejectedValueOnce(new Error('NoSuchKey'));
        const client = new StorageClient(config);

        await expect(client.downloadObject('bucket-f', 'missing.txt')).rejects.toBeInstanceOf(StorageError);
    });

    it('downloadObject throws StorageError when body is empty', async () => {
        sendMock.mockResolvedValueOnce({ Body: null });
        const client = new StorageClient(config);

        await expect(client.downloadObject('bucket-g', 'empty.txt')).rejects.toThrow(
            'Storage error: {"operation":"downloadObject","error":"Received empty body","Bucket":"bucket-g","Key":"empty.txt"}'
        );
    });

    it('getPresignedUrl returns signed URL from presigner', async () => {
        const signedUrl = 'https://s3.example.com/bucket/file.txt?X-Amz-Signature=abc';
        getSignedUrlMock.mockResolvedValueOnce(signedUrl);
        const client = new StorageClient(config);

        const result = await client.getPresignedUrl('bucket-h', 'file.txt', 3600);

        expect(result).toBe(signedUrl);
        expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
        expect(getSignedUrlMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(GetObjectCommand),
            { expiresIn: 3600 }
        );
    });

    it('getPresignedUrl wraps presigner failures in StorageError', async () => {
        getSignedUrlMock.mockRejectedValueOnce(new Error('SigningError'));
        const client = new StorageClient(config);

        await expect(client.getPresignedUrl('bucket-i', 'file.txt', 3600)).rejects.toBeInstanceOf(StorageError);
    });

    it('deleteObject sends DeleteObjectCommand', async () => {
        sendMock.mockResolvedValueOnce({});
        const client = new StorageClient(config);

        await client.deleteObject('bucket-j', 'file.txt');

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
        expect((sendMock.mock.calls[0][0] as { input: { Bucket: string; Key: string } }).input).toMatchObject({ Bucket: 'bucket-j', Key: 'file.txt' });
    });

    it('deleteObject wraps failures in StorageError', async () => {
        sendMock.mockRejectedValueOnce(new Error('AccessDenied'));
        const client = new StorageClient(config);

        await expect(client.deleteObject('bucket-k', 'file.txt')).rejects.toBeInstanceOf(StorageError);
    });

    it('clearPrefix does nothing when prefix has no objects', async () => {
        sendMock.mockResolvedValueOnce({ Contents: [] });
        const client = new StorageClient(config);

        await client.clearPrefix('bucket-l', 'prefix/');

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0][0]).toBeInstanceOf(ListObjectsCommand);
    });

    it('clearPrefix deletes all objects under the prefix', async () => {
        sendMock
            .mockResolvedValueOnce({ Contents: [{ Key: 'prefix/a.txt' }, { Key: 'prefix/b.txt' }] })
            .mockResolvedValue({});
        const client = new StorageClient(config);

        await client.clearPrefix('bucket-m', 'prefix/');

        expect(sendMock.mock.calls[0][0]).toBeInstanceOf(ListObjectsCommand);
        expect((sendMock.mock.calls[0][0] as { input: { Bucket: string; Prefix: string } }).input).toMatchObject({ Bucket: 'bucket-m', Prefix: 'prefix/' });
    });

    it('clearPrefix wraps list failures in StorageError', async () => {
        sendMock.mockRejectedValueOnce(new Error('ListDenied'));
        const client = new StorageClient(config);

        await expect(client.clearPrefix('bucket-n', 'prefix/')).rejects.toBeInstanceOf(StorageError);
    });
});