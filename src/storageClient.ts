import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isEmpty, isNil, isNotNil, pluck } from "ramda";
import { Readable } from "stream";
import { StorageConfig } from "./config";
import { StorageError, StorageObject, UploadObjectOptions } from "./types";
import { runInBatches } from "./utils/batches";

export class StorageClient {
    private client: S3Client;

    constructor(private readonly config: StorageConfig) {
        this.client = new S3Client(config);
    }

    private clearObjects = async (bucketName: string, objectKeys: string[]) => {
        const clearObjectOperation = (key: string) => this.deleteObject(bucketName, key);
        const clearProgressLog = (index: number, total: number) => `cleared ${index / total * 100}% of prefix files (${index}/${total} batches)`;
        await runInBatches(objectKeys, this.config.batchSize, clearObjectOperation, clearProgressLog);
    }

    ensureBucket = (bucketName: string) =>
        this.client
            .send(new HeadBucketCommand({ Bucket: bucketName }))
            .catch(async (error) => {
                if (error.name === 'NotFound') {
                    await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
                } else {
                    throw new StorageError("ensureBucket", error, { bucketName });
                }
            });

    deleteBucket = async (bucketName: string) =>
        this.client
            .send(new DeleteBucketCommand({ Bucket: bucketName }))
            .catch(async (error) => {
                if (error.name === 'NoSuchBucket') {
                    return;
                } else if (error.name === 'BucketNotEmpty') {
                    await this.clearPrefix(bucketName, "");
                    await this.client.send(new DeleteBucketCommand({ Bucket: bucketName }));
                } else {
                    throw new StorageError("deleteBucket", error as Error, { bucketName });
                }
            });

    clearPrefix = (Bucket: string, Prefix: string) =>
        this.client
            .send(new ListObjectsCommand({ Bucket, Prefix: Prefix }))
            .then(async ({ Contents: listedObjects }) => {
                if (isNil(listedObjects) || isEmpty(listedObjects)) {
                    return;
                } else {
                    const objectKeys = pluck('Key', listedObjects).filter(isNotNil);
                    await this.clearObjects(Bucket, objectKeys);
                }
            })
            .catch((error) => {
                throw new StorageError("clearPrefix", error as Error, { Bucket, prefix: Prefix });
            });

    uploadObjects = async (Bucket: string, objects: StorageObject[], options?: UploadObjectOptions) =>
        runInBatches(
            objects,
            this.config.batchSize,
            (object) => this.uploadObject(Bucket, object, options),
            (index, total) => `Uploaded ${index / total * 100}% of files (${index}/${total} batches)`
        );

    uploadObject = async (Bucket: string, object: StorageObject, options?: UploadObjectOptions) => {
        const { key: Key, data: Body } = object;
        if (options?.ensureBucket) {
            await this.ensureBucket(Bucket);
        }
        try {
            if (options?.multipartUpload) {
                const upload = new Upload({
                    client: this.client,
                    params: { Bucket, Key, Body },
                    queueSize: this.config.maxConcurrency,
                    partSize: this.config.partSize
                })
                upload.on("httpUploadProgress", (progress) => {
                    console.log(`Upload progress for ${Key}: ${progress.loaded! / progress.total! * 100}%`);
                });
                await upload.done();
            } else {
                await this.client.send(new PutObjectCommand({ Bucket, Key, Body }));
            }
        } catch (error) {
            throw new StorageError("uploadObject", error as Error, { Bucket, Key });
        }
    }

    downloadObject = (Bucket: string, Key: string): Promise<Readable> =>
        this.client
            .send(new GetObjectCommand({ Bucket, Key }))
            .then((({ Body }) => {
                if (isNil(Body)) {
                    throw new Error("Received empty body");
                }
                return Body as Readable;
            })).catch((error) => {
                throw new StorageError("downloadObject", error as Error, { Bucket, Key });
            });

    getPresignedUrl = (Bucket: string, Key: string, expiresInSeconds: number): Promise<string> =>
        getSignedUrl(this.client, new GetObjectCommand({ Bucket, Key }), { expiresIn: expiresInSeconds }).catch((error) => {
            throw new StorageError("getPresignedUrl", error, { Bucket, Key, expiresInSeconds });
        });


    deleteObject = (Bucket: string, Key: string) =>
        this.client
            .send(new DeleteObjectCommand({ Bucket, Key }))
            .catch((error) => {
                if (error.name !== 'NoSuchKey') {
                    throw new StorageError("deleteObject", error, { Bucket, Key });
                }
            });
}