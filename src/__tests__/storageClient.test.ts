import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { CreateBucketCommand, DeleteBucketCommand, HeadBucketCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { StorageClient } from '../storageClient';
import { StorageError } from '../types';

const sendMock = jest.fn<Promise<unknown>, [unknown]>();

jest.mock('@aws-sdk/client-s3', () => {
    class MockS3ServiceException extends Error {
        constructor(name: string) {
            super(name);
            this.name = name;
        }
    }

    class MockHeadBucketCommand {
        constructor(public readonly input: unknown) { }
    }

    class MockCreateBucketCommand {
        constructor(public readonly input: unknown) { }
    }

    class MockDeleteBucketCommand {
        constructor(public readonly input: unknown) { }
    }

    return {
        S3Client: jest.fn().mockImplementation(() => ({
            send: sendMock
        })),
        HeadBucketCommand: MockHeadBucketCommand,
        CreateBucketCommand: MockCreateBucketCommand,
        DeleteBucketCommand: MockDeleteBucketCommand,
        S3ServiceException: MockS3ServiceException
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

    it('uploadObject wraps S3ServiceException in StorageError', async () => {
        const sdkError = new S3ServiceException({
            name: 'UploadDenied',
            $fault: 'client',
            $metadata: {}
        });
        uploadDoneMock.mockRejectedValueOnce(sdkError);
        const client = new StorageClient(config);

        await expect(client.uploadObject('bucket-c', 'file.txt', Readable.from(['x']))).rejects.toBeInstanceOf(StorageError);
    });

    it('uploadObject rethrows unknown errors', async () => {
        const error = new Error('unexpected');
        uploadDoneMock.mockRejectedValueOnce(error);
        const client = new StorageClient(config);

        await expect(client.uploadObject('bucket-d', 'file.txt', Readable.from(['x']))).rejects.toBe(error);
    });
});