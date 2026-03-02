import { createStorageConfig } from '../config';
import { ZodError } from 'zod';

describe('createStorageClientConfig', () => {
    const originalEnv = process.env;
    const getThrownZodError = (): ZodError => {
        try {
            createStorageConfig();
            throw new Error('Expected createStorageConfig to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            return error as ZodError;
        }
    };

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

        const config = createStorageConfig();

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

        const config = createStorageConfig();

        expect(config.region).toBe('us-east-1');
        expect(config.partSize).toBe(5 * 1024 * 1024);
        expect(config.maxConcurrency).toBe(4);
    });

    it('throws when required values are missing', () => {
        delete process.env.AWS_ENDPOINT;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;

        const error = getThrownZodError();

        expect(error.issues).toHaveLength(3);
        expect(error.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: ['AWS_ENDPOINT'], code: 'invalid_type', expected: 'string', received: 'undefined', message: 'Required' }),
                expect.objectContaining({ path: ['AWS_ACCESS_KEY_ID'], code: 'invalid_type', expected: 'string', received: 'undefined', message: 'Required' }),
                expect.objectContaining({ path: ['AWS_SECRET_ACCESS_KEY'], code: 'invalid_type', expected: 'string', received: 'undefined', message: 'Required' }),
            ])
        );
    });

    it('throws when endpoint is not a valid URL', () => {
        process.env.AWS_ENDPOINT = 'not-a-url';
        process.env.AWS_ACCESS_KEY_ID = 'key-id';
        process.env.AWS_SECRET_ACCESS_KEY = 'secret';

        const error = getThrownZodError();

        expect(error.issues).toHaveLength(1);
        expect(error.issues[0]).toMatchObject({
            path: ['AWS_ENDPOINT'],
            code: 'invalid_string',
            validation: 'url',
            message: 'Invalid url',
        });
    });

    it('throws when part size is not a finite number', () => {
        process.env.AWS_ENDPOINT = 'http://localhost:9000';
        process.env.AWS_ACCESS_KEY_ID = 'key-id';
        process.env.AWS_SECRET_ACCESS_KEY = 'secret';
        process.env.AWS_PART_SIZE = 'invalid-number';

        const error = getThrownZodError();

        expect(error.issues).toHaveLength(1);
        expect(error.issues[0]).toMatchObject({
            path: ['AWS_PART_SIZE'],
            code: 'invalid_type',
            expected: 'number',
            received: 'nan',
            message: 'Expected number, received nan',
        });
    });

    it('throws when max concurrency is not a finite number', () => {
        process.env.AWS_ENDPOINT = 'http://localhost:9000';
        process.env.AWS_ACCESS_KEY_ID = 'key-id';
        process.env.AWS_SECRET_ACCESS_KEY = 'secret';
        process.env.AWS_MAX_CONCURRENCY = 'Infinity';

        const error = getThrownZodError();

        expect(error.issues).toHaveLength(1);
        expect(error.issues[0]).toMatchObject({
            path: ['AWS_MAX_CONCURRENCY'],
            code: 'not_finite',
            message: 'Number must be finite',
        });
    });
});
