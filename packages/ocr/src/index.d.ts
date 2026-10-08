export type DocumentType =
  | "AADHAAR"
  | "PAN"
  | "VOTER_ID"
  | "DRIVING_LICENSE"
  | "RATION_CARD"
  | "PASSPORT";
export interface SandbeeOptions {
  token: string;
  installationId: string;
  label: string;
  publicKey: string;
  issuer?: string;
  allowLocalDevelopment?: boolean;
}
export interface ExtractOptions {
  documentType: DocumentType;
  files: string[];
  mode?: "balanced" | "accurate";
  includeText?: boolean;
  pdfPassword?: string;
}
export interface ExtractedField {
  value: string | null;
  confidence: number | null;
  valid: boolean;
  status: "extracted" | "review" | "conflict" | "missing";
  source: string | null;
  variant?: string;
  fileIndex?: number;
}
export interface ExtractResult {
  documentType: DocumentType;
  status: "ready" | "needs_review";
  fields: Record<string, ExtractedField>;
  conflicts: string[];
  documentAuthenticity: "not_verified";
  text?: string;
  files: unknown[];
  meta: {
    processingMs: number;
    execution: "customer_server";
    documentsUploaded: false;
    [key: string]: unknown;
  };
}
export class SandbeeOCR {
  constructor(options: SandbeeOptions);
  start(): Promise<this>;
  extract(options: ExtractOptions): Promise<ExtractResult>;
  close(): void;
}
