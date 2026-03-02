import { S3ClientConfig } from "@aws-sdk/client-s3";
import { z } from "zod";

export interface StorageConfig extends S3ClientConfig {
    partSize: number; // Optional configuration for multipart upload part size
    maxConcurrency: number; // Optional configuration for maximum concurrency in multipart uploads
}

const StorageEnvSchema = z
    .object({
        AWS_ENDPOINT: z.string().url(),
        AWS_REGION: z.string().default("us-east-1"),
        AWS_ACCESS_KEY_ID: z.string(),
        AWS_SECRET_ACCESS_KEY: z.string(),
        AWS_PART_SIZE: z.coerce.number().finite().default(5 * 1024 * 1024),
        AWS_MAX_CONCURRENCY: z.coerce.number().finite().default(4),
    })

export const createStorageConfig = (): StorageConfig => {
    const value = StorageEnvSchema.parse(process.env);
    return {
        endpoint: value.AWS_ENDPOINT,
        region: value.AWS_REGION,
        credentials: {
            accessKeyId: value.AWS_ACCESS_KEY_ID,
            secretAccessKey: value.AWS_SECRET_ACCESS_KEY,
        },
        partSize: value.AWS_PART_SIZE,
        maxConcurrency: value.AWS_MAX_CONCURRENCY,
    };
};
