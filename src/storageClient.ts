import { CreateBucketCommand, DeleteBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { isNil } from "ramda";
import { StorageError, UploadObjectOptions } from "./types";
import { StorageClientConfig } from "./config";

export class StorageClient {
    private client: S3Client;
    constructor(private readonly config: StorageClientConfig) {
        this.client = new S3Client(config);
    }
    ensureBucket = async (bucketName: string) => {
        await this.client.send(new HeadBucketCommand({ Bucket: bucketName })).catch(async (error) => {
            if (error.name === 'NotFound') {
                await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
            } else {
                throw new StorageError("ensureBucket", error, { bucketName });
            }
        });
    };
    deleteBucket = async (bucketName: string) => {
        await this.client.send(new DeleteBucketCommand({ Bucket: bucketName })).catch((error) => {
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
            if (options?.multipartUpload) {
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
            } else {
                await this.client.send(new PutObjectCommand({ Bucket: bucketName, Key: objectKey, Body: objectData }));
            }
        } catch (error) {
            throw new StorageError("uploadObject", error as Error, { bucketName, objectKey });
        }
    }

    downloadObject = async (bucketName: string, objectKey: string): Promise<Readable> => {
        try {
            const { Body } = await this.client.send(new GetObjectCommand({ Bucket: bucketName, Key: objectKey }))
            if (isNil(Body)) {
                throw new Error("Received empty body");
            }
            return Body as Readable;
        } catch (error) {
            throw new StorageError("downloadObject", error as Error, { bucketName, objectKey });
        }
    }
}