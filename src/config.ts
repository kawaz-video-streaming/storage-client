import { S3ClientConfig } from "@aws-sdk/client-s3";
import Joi from "joi";

export interface StorageClientConfig extends S3ClientConfig {
    partSize: number; // Optional configuration for multipart upload part size
    maxConcurrency: number; // Optional configuration for maximum concurrency in multipart uploads
}

interface StorageClientEnv {
    AWS_ENDPOINT: string;
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_PART_SIZE: number;
    AWS_MAX_CONCURRENCY: number;
}

const StorageClientEnvSchema = Joi.object<StorageClientEnv>({
    AWS_ENDPOINT: Joi.string().uri().required(),
    AWS_REGION: Joi.string().default("us-east-1"),
    AWS_ACCESS_KEY_ID: Joi.string().required(),
    AWS_SECRET_ACCESS_KEY: Joi.string().required(),
    AWS_PART_SIZE: Joi.number().default(5 * 1024 * 1024),
    AWS_MAX_CONCURRENCY: Joi.number().default(4),
});

export const createStorageClientConfig = (): StorageClientConfig => {
    const { error, value } = StorageClientEnvSchema.validate(process.env, { allowUnknown: true });
    if (error) {
        throw error;
    }
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
