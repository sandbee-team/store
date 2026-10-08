import type { BatchFileResult, DocumentType, ExtractResult } from './types';
export declare const REQUIRED_FIELD_GROUPS: Record<DocumentType, readonly (readonly string[])[]>;
export declare function normalizeForCompare(value: string): string;
export declare function mergeEnvelopes(documentType: DocumentType, catalogFields: readonly string[], fileResults: BatchFileResult[], wallMs: number, opts: {
    returnRawText?: boolean;
}): ExtractResult;
export declare function earlyStopSatisfied(documentType: DocumentType, fileResults: BatchFileResult[], catalogFields?: readonly string[]): boolean;
