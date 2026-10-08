import type { BatchExtractInput, BatchExtractResult, DocumentType, ExtractInput, ExtractResult } from './types';
export declare const BATCH_TMP_DIR: string;
export type NativeExtractFn = <T extends DocumentType>(input: ExtractInput<T>) => Promise<ExtractResult<T>>;
export declare function createBatchRunner(extractFn: NativeExtractFn): <T extends DocumentType>(input: BatchExtractInput<T>) => Promise<BatchExtractResult<T>>;
