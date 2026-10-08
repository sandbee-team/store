export declare const DOCUMENT_TYPES: readonly ["AADHAAR", "PAN", "VOTER_ID", "DRIVING_LICENSE", "RATION_CARD", "PASSPORT"];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export interface ExtractOptions {
    enableQr?: boolean;
    enableOcr?: boolean;
    enablePreprocessing?: boolean;
    enableNeural?: boolean;
    returnRawText?: boolean;
    returnDebugInfo?: boolean;
    maxPages?: number;
    timeoutMs?: number;
    neuralThreads?: number;
    pdfPassword?: string;
}
export interface ExtractInput<T extends DocumentType = DocumentType> {
    filePath: string;
    documentType: T;
    fileType?: string;
    fields?: ReadonlyArray<DataFieldOf<T>>;
    options?: ExtractOptions;
}
export interface AadhaarData {
    name?: string | null;
    dob?: string | null;
    yearOfBirth?: string | null;
    gender?: string | null;
    aadhaarNumber?: string | null;
    maskedAadhaarNumber?: string | null;
    vid?: string | null;
    address?: string | null;
}
export interface PanData {
    name?: string | null;
    fatherName?: string | null;
    dob?: string | null;
    panNumber?: string | null;
}
export interface VoterIdData {
    epicNumber?: string | null;
    name?: string | null;
    relationName?: string | null;
    relationType?: string | null;
    gender?: string | null;
    dob?: string | null;
    age?: string | null;
    address?: string | null;
    issueDate?: string | null;
    downloadDate?: string | null;
}
export interface DrivingLicenseData {
    dlNumber?: string | null;
    name?: string | null;
    relationName?: string | null;
    relationType?: string | null;
    dob?: string | null;
    address?: string | null;
    issueDate?: string | null;
    validityNonTransport?: string | null;
    validityTransport?: string | null;
    vehicleClasses?: string | null;
    badgeNo?: string | null;
}
export interface RationCardData {
    cardNumber?: string | null;
    cardType?: string | null;
    headOfFamily?: string | null;
    memberCount?: string | null;
    members?: string | null;
    fpsDetails?: string | null;
    address?: string | null;
    state?: string | null;
    issueDate?: string | null;
    validUpto?: string | null;
}
export interface PassportData {
    passportNumber?: string | null;
    name?: string | null;
    dob?: string | null;
    sex?: string | null;
    nationality?: string | null;
    dateOfIssue?: string | null;
    dateOfExpiry?: string | null;
    placeOfBirth?: string | null;
    placeOfIssue?: string | null;
}
export interface DataByType {
    AADHAAR: AadhaarData;
    PAN: PanData;
    VOTER_ID: VoterIdData;
    DRIVING_LICENSE: DrivingLicenseData;
    RATION_CARD: RationCardData;
    PASSPORT: PassportData;
}
export type DataFieldOf<T extends DocumentType> = keyof DataByType[T] & string;
type AssertTrueEarly<C extends true> = C;
export declare const DATA_FIELDS_BY_TYPE: {
    readonly AADHAAR: readonly ["name", "dob", "yearOfBirth", "gender", "aadhaarNumber", "maskedAadhaarNumber", "vid", "address"];
    readonly PAN: readonly ["name", "fatherName", "dob", "panNumber"];
    readonly VOTER_ID: readonly ["epicNumber", "name", "relationName", "relationType", "gender", "dob", "age", "address", "issueDate", "downloadDate"];
    readonly DRIVING_LICENSE: readonly ["dlNumber", "name", "relationName", "relationType", "dob", "address", "issueDate", "validityNonTransport", "validityTransport", "vehicleClasses", "badgeNo"];
    readonly RATION_CARD: readonly ["cardNumber", "cardType", "headOfFamily", "memberCount", "members", "fpsDetails", "address", "state", "issueDate", "validUpto"];
    readonly PASSPORT: readonly ["passportNumber", "name", "dob", "sex", "nationality", "dateOfIssue", "dateOfExpiry", "placeOfBirth", "placeOfIssue"];
};
export type _CatalogComplete = AssertTrueEarly<{
    [K in DocumentType]: keyof DataByType[K] extends (typeof DATA_FIELDS_BY_TYPE)[K][number] ? true : false;
}[DocumentType]>;
export interface ValidationsByType {
    AADHAAR: 'aadhaarRegexValid' | 'aadhaarChecksumValid' | 'dobValid' | 'yearOfBirthValid' | 'genderValid' | 'nameValid' | 'vidValid' | 'addressValid';
    PAN: 'panRegexValid' | 'dobValid' | 'nameValid' | 'fatherNameValid';
    VOTER_ID: 'epicRegexValid' | 'nameValid' | 'relationNameValid' | 'genderValid' | 'dobValid' | 'ageValid' | 'addressValid' | 'issueDateValid' | 'downloadDateValid';
    DRIVING_LICENSE: 'dlRegexValid' | 'dlStateValid' | 'nameValid' | 'relationNameValid' | 'dobValid' | 'addressValid' | 'issueDateValid' | 'validityNonTransportValid' | 'validityTransportValid';
    RATION_CARD: 'rationRegexValid' | 'headOfFamilyValid' | 'memberCountValid' | 'addressValid' | 'stateValid' | 'issueDateValid' | 'validUptoValid';
    PASSPORT: 'passportRegexValid' | 'passportChecksumValid' | 'nameValid' | 'dobValid' | 'dobChecksumValid' | 'sexValid' | 'nationalityValid' | 'dateOfIssueValid' | 'dateOfExpiryValid' | 'expiryChecksumValid' | 'placeOfBirthValid' | 'placeOfIssueValid' | 'mrzCompositeValid' | 'mrzVizMatchValid';
}
export interface LayoutByType {
    AADHAAR: 'aadhaar-eaadhaar' | 'aadhaar-pvc-2020' | 'aadhaar-2010-letter';
    PAN: 'pan-epan-qr' | 'pan-2017-labelled' | 'pan-pre2017';
    VOTER_ID: 'voter-eepic-2021' | 'voter-pvc-2015' | 'voter-gen1-barcode' | 'voter-gen1-laminate';
    DRIVING_LICENSE: 'dl-form7-2019' | 'dl-legacy-state' | 'dl-smartcard-cov';
    RATION_CARD: 'ration-wb-digital' | 'ration-gj-pvc' | 'ration-mh-card' | 'ration-up-booklet';
    PASSPORT: 'passport-mrz';
}
export type Layout<T extends DocumentType = DocumentType> = LayoutByType[T] | 'unknown' | (string & {});
export type ErrorCode = 'INVALID_INPUT' | 'FILE_NOT_FOUND' | 'UNSUPPORTED_DOCUMENT_TYPE' | 'UNSUPPORTED_FILE_TYPE' | 'LOW_QUALITY_IMAGE' | 'OCR_FAILED' | 'QR_READ_FAILED' | 'FIELD_NOT_FOUND' | 'VALIDATION_FAILED' | 'TIMEOUT' | 'QUEUE_FULL' | 'INTERNAL_ERROR';
export type BatchErrorCode = 'BATCH_EMPTY' | 'TOO_MANY_FILES' | 'UNSUPPORTED_INPUT' | 'DOWNLOAD_FAILED' | 'FILE_TOO_LARGE' | 'FIELD_CONFLICT';
export interface ExtractError {
    code: ErrorCode | BatchErrorCode;
    message: string;
    field?: string;
}
export type QualityIssue = 'LOW_RESOLUTION' | 'LOW_OCR_CONFIDENCE' | 'ROTATED_INPUT' | 'SMALL_TEXT' | 'NEURAL_RESCUE_USED' | 'QR_NOT_READ' | 'MRZ_NOT_READ';
export interface Quality {
    score: number;
    level: 'good' | 'fair' | 'poor' | 'unknown';
    ocrConfidence: number | null;
    inputLongEdge: number | null;
    issues: QualityIssue[];
}
export interface Source {
    qrUsed: boolean;
    ocrUsed: boolean;
    textPdfUsed: boolean;
    neuralUsed: boolean;
    qrUnauthenticated?: boolean;
}
export interface Engines {
    zxing: boolean;
    tesseract: boolean;
    leptonica: boolean;
    pdfium: boolean;
    onnxruntime: boolean;
    neuralModels: boolean;
}
export type FieldProvenance = 'qr' | 'pdfText' | 'ocr' | 'neural' | 'mrz';
export interface FieldDetail {
    validationSource: FieldProvenance;
    confidence: number;
    fileIndex?: number;
}
export interface Resources {
    queueMs: number;
    cpuMs: number;
    cpuPercent: number;
    rssMb: number;
    rssDeltaMb: number;
}
export interface ExtractResult<T extends DocumentType = DocumentType> {
    success: boolean;
    documentType: T;
    layout: Layout<T>;
    fileType: string;
    data: Partial<DataByType[T]>;
    validations: Partial<Record<ValidationsByType[T], boolean>>;
    fieldDetails?: Partial<Record<DataFieldOf<T>, FieldDetail>>;
    confidence: number;
    quality: Quality;
    processingTimeMs: number;
    source: Source;
    engines?: Engines;
    errors: ExtractError[];
    rawText?: string;
    debug?: Record<string, unknown>;
    resources?: Resources;
    batch?: BatchInfo<T>;
}
export type BatchFileStatus = 'processed' | 'skipped' | 'failed';
export interface BatchFileResult<T extends DocumentType = DocumentType> {
    index: number;
    input: string;
    status: BatchFileStatus;
    result: ExtractResult<T> | null;
}
export interface BatchInfo<T extends DocumentType = DocumentType> {
    filesTotal: number;
    filesProcessed: number;
    filesSkipped: number;
    filesFailed: number;
    results: BatchFileResult<T>[];
}
export interface BatchOptions extends ExtractOptions {
    deleteInputFiles?: boolean;
    earlyStop?: boolean;
    concurrency?: number;
}
export interface BatchExtractInput<T extends DocumentType = DocumentType> {
    files: string[];
    documentType: T;
    fields?: ReadonlyArray<DataFieldOf<T>>;
    options?: BatchOptions;
}
export type BatchExtractResult<T extends DocumentType = DocumentType> = ExtractResult<T> & {
    batch: BatchInfo<T>;
};
export declare const ENVELOPE_KEYS_ALWAYS: readonly ["success", "documentType", "layout", "fileType", "data", "validations", "confidence", "quality", "processingTimeMs", "source", "errors"];
export declare const ENVELOPE_KEYS_OPTIONAL: readonly ["fieldDetails", "engines", "rawText", "debug", "resources", "batch"];
type AlwaysKey = (typeof ENVELOPE_KEYS_ALWAYS)[number];
type OptionalKey = (typeof ENVELOPE_KEYS_OPTIONAL)[number];
type AssertTrue<C extends true> = C;
type MutuallyExclusive = AlwaysKey & OptionalKey extends never ? true : false;
type Covers = keyof ExtractResult extends AlwaysKey | OptionalKey ? true : false;
type NoExtras = AlwaysKey | OptionalKey extends keyof ExtractResult ? true : false;
export type _EnvelopeKeysExclusive = AssertTrue<MutuallyExclusive>;
export type _EnvelopeKeysCover = AssertTrue<Covers>;
export type _EnvelopeKeysNoExtras = AssertTrue<NoExtras>;
export interface ConformanceReport {
    ok: boolean;
    unknown: string[];
    missing: string[];
}
export {};
