import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { CreateBucketCommand, DeleteBucketCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
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

    return {
        S3Client: jest.fn().mockImplementation(() => ({
            send: sendMock
        })),
        HeadBucketCommand: MockHeadBucketCommand,
        CreateBucketCommand: MockCreateBucketCommand,
        DeleteBucketCommand: MockDeleteBucketCommand,
        GetObjectCommand: MockGetObjectCommand
    };
});

const uploadOnMock = jest.fn<void, [string, (...args: unknown[]) => void]>();
const uploadDoneMock = jest.fn<Promise<void>, []>();

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
        maxConcurrency: 4
    };

    beforeEach(() => {
        jest.clearAllMocks();
        sendMock.mockReset();
        uploadDoneMock.mockReset();
        uploadOnMock.mockReset();
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

    it('uploadObject runs Upload with config and object params', async () => {
        uploadDoneMock.mockResolvedValueOnce();
        const client = new StorageClient(config);
        const objectData = Readable.from(['hello']);

        await client.uploadObject('bucket-a', 'path/file.txt', objectData);

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

        await client.uploadObject('bucket-b', 'file.txt', Readable.from(['x']), { ensureBucket: true });

        expect(ensureBucketSpy).toHaveBeenCalledWith('bucket-b');
    });

    it('uploadObject wraps upload failures in StorageError', async () => {
        uploadDoneMock.mockRejectedValueOnce(new Error('UploadDenied'));
        const client = new StorageClient(config);

        await expect(client.uploadObject('bucket-c', 'file.txt', Readable.from(['x']))).rejects.toBeInstanceOf(StorageError);
    });

    it('uploadObject includes operation and context in wrapped error message', async () => {
        const error = new Error('unexpected');
        uploadDoneMock.mockRejectedValueOnce(error);
        const client = new StorageClient(config);

        await expect(client.uploadObject('bucket-d', 'file.txt', Readable.from(['x']))).rejects.toThrow(
            'Storage error: {"operation":"uploadObject","error":"unexpected","bucketName":"bucket-d","objectKey":"file.txt"}'
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
            'Storage error: {"operation":"downloadObject","error":"Received empty body","bucketName":"bucket-g","objectKey":"empty.txt"}'
        );
    });
});