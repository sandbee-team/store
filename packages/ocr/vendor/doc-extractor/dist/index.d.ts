import type { ConformanceReport, DocumentType, ExtractInput, ExtractResult } from './types';
export * from './types';
export declare class DocExtractorError extends Error {
    readonly code: 'PLATFORM_UNSUPPORTED' | 'PREBUILT_MISSING' | 'LOAD_FAILED';
    constructor(code: DocExtractorError['code'], message: string);
}
export declare function platformKey(): string;
export declare function extract<T extends DocumentType>(input: ExtractInput<T>): Promise<ExtractResult<T>>;
export declare const extractBatch: <T extends DocumentType>(input: import("./types").BatchExtractInput<T>) => Promise<import("./types").BatchExtractResult<T>>;
export { BATCH_TMP_DIR } from './batch';
export interface Capabilities {
    name: string;
    version: string;
    platform: string;
    tier?: string;
    documentTypes: readonly DocumentType[];
    platforms: string[];
    enginePins?: Record<string, unknown>;
    manifest?: Record<string, unknown>;
}
export declare function capabilities(): Capabilities;
export declare function checkEnvelopeConformance(result: unknown): ConformanceReport;
