import { createStorageClientConfig } from '../config';

describe('createStorageClientConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('creates config from environment variables', () => {
        process.env.AWS_ENDPOINT = 'http://localhost:9000';
        process.env.AWS_REGION = 'eu-west-1';
        process.env.AWS_ACCESS_KEY_ID = 'key-id';
        process.env.AWS_SECRET_ACCESS_KEY = 'secret';
        process.env.AWS_PART_SIZE = '10485760';
        process.env.AWS_MAX_CONCURRENCY = '8';

        const config = createStorageClientConfig();

        expect(config).toEqual({
            endpoint: 'http://localhost:9000',
            region: 'eu-west-1',
            credentials: {
                accessKeyId: 'key-id',
                secretAccessKey: 'secret'
            },
            partSize: 10485760,
            maxConcurrency: 8
        });
    });

    it('uses defaults for optional values', () => {
        process.env.AWS_ENDPOINT = 'http://localhost:9000';
        process.env.AWS_ACCESS_KEY_ID = 'key-id';
        process.env.AWS_SECRET_ACCESS_KEY = 'secret';
        delete process.env.AWS_REGION;
        delete process.env.AWS_PART_SIZE;
        delete process.env.AWS_MAX_CONCURRENCY;

        const config = createStorageClientConfig();

        expect(config.region).toBe('us-east-1');
        expect(config.partSize).toBe(5 * 1024 * 1024);
        expect(config.maxConcurrency).toBe(4);
    });

    it('throws when required values are missing', () => {
        delete process.env.AWS_ENDPOINT;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;

        expect(() => createStorageClientConfig()).toThrow();
    });
});
