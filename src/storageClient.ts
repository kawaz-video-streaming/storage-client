import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { isNil, isNotNil } from "ramda";
import { StorageError, UploadObjectOptions } from "./types";
import { StorageConfig } from "./config";

export class StorageClient {
    private client: S3Client;

    constructor(private readonly config: StorageConfig) {
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

    clearPrefix = async (bucketName: string, prefix: string) => {
        try {
            const listCommand = new ListObjectsCommand({ Bucket: bucketName, Prefix: prefix });
            const listedObjects = (await this.client.send(listCommand)).Contents;
            if (isNil(listedObjects) || listedObjects.length === 0) {
                return;
            } else {
                listedObjects.map(async ({ Key }) => {
                    if (isNotNil(Key)) {
                        await this.deleteObject(bucketName, Key);
                    }
                });
            }
        } catch (error) {
            throw new StorageError("clearPrefix", error as Error, { bucketName, prefix });
        }
    }

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

    getPresignedUrl = async (bucketName: string, objectKey: string, expiresInSeconds: number): Promise<string> => {
        try {
            const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
            return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
        } catch (error) {
            throw new StorageError("getPresignedUrl", error as Error, { bucketName, objectKey });
        }
    }

    deleteObject = async (bucketName: string, objectKey: string) => {
        try {
            await this.client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }));
        } catch (error) {
            throw new StorageError("deleteObject", error as Error, { bucketName, objectKey });
        }
    }
}