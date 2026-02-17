import { CreateBucketCommand, DeleteBucketCommand, HeadBucketCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { StorageClientConfig, StorageError, UploadObjectOptions } from "./types";

export class StorageClient {
    private client: S3Client;
    constructor(private readonly config: StorageClientConfig) {
        this.client = new S3Client(config);
    }
    ensureBucket = async (bucketName: string) => {
        await this.client.send(new HeadBucketCommand({ Bucket: bucketName })).catch(async (error: S3ServiceException) => {
            if (error.name === 'NotFound') {
                await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
            } else {
                throw new StorageError("ensureBucket", error, { bucketName });
            }
        });
    };
    deleteBucket = async (bucketName: string) => {
        await this.client.send(new DeleteBucketCommand({ Bucket: bucketName })).catch((error: S3ServiceException) => {
            if (error.name !== 'NoSuchBucket') {
                throw new StorageError("deleteBucket", error, { bucketName });
            }
        });
    };

    uploadObject = async (bucketName: string, objectKey: string, objectData: Readable, options?: UploadObjectOptions) => {
        if (options?.ensureBucket) {
            await this.ensureBucket(bucketName);
        }
        try {
            const upload = new Upload({
                client: this.client,
                params: { Bucket: bucketName, Key: objectKey, Body: objectData },
                queueSize: this.config.maxConcurrency,
                partSize: this.config.partSize
            })
            upload.on("httpUploadProgress", (progress) => {
                console.log(`Upload progress for ${objectKey}: ${progress.loaded! / progress.total! * 100}%`);
            });
            await upload.done();
        } catch (error) {
            if (error instanceof S3ServiceException) {
                throw new StorageError("uploadObject", error, { bucketName, objectKey });
            }
            throw error;
        }
    }
}