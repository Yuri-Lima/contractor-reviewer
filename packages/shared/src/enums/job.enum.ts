export enum JobType {
  OCR = 'ocr',
  PARSING = 'parsing',
  CHUNKING = 'chunking',
  EMBEDDING = 'embedding',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}
