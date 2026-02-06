import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { StorageServiceToken, IStorageService } from '../storage/storage.module';
import pdfParse from 'pdf-parse';

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  pages: ParsedPage[];
  totalPages: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
  };
  fullText: string;
}

@Injectable()
export class PdfParserService {
  constructor(
    @Inject(StorageServiceToken)
    private storageService: IStorageService,
  ) {}

  /**
   * Parse PDF file from storage
   */
  async parsePdf(storageKey: string): Promise<ParsedDocument> {
    // Get file from storage
    // For local storage, read directly
    // For S3, download first
    const fileBuffer = await this.getFileBuffer(storageKey);

    // Parse PDF
    const pdfData = await pdfParse(fileBuffer);

    const pages: ParsedPage[] = [];
    const totalPages = pdfData.numpages;

    // Extract text per page
    // Note: pdf-parse doesn't provide per-page text directly
    // We'll use the full text and estimate page boundaries
    const fullText = pdfData.text;
    const estimatedCharsPerPage = Math.ceil(fullText.length / totalPages);

    for (let i = 0; i < totalPages; i++) {
      const start = i * estimatedCharsPerPage;
      const end = Math.min((i + 1) * estimatedCharsPerPage, fullText.length);
      pages.push({
        pageNumber: i + 1,
        text: fullText.substring(start, end).trim(),
      });
    }

    return {
      pages,
      totalPages,
      metadata: {
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        subject: pdfData.info?.Subject,
        creator: pdfData.info?.Creator,
      },
      fullText,
    };
  }

  /**
   * Get file buffer from storage
   */
  private async getFileBuffer(storageKey: string): Promise<Buffer> {
    return await this.storageService.getFileBuffer(storageKey);
  }

  /**
   * Check if PDF is scanned (image-based) and needs OCR
   * Returns true if extracted text is below threshold
   */
  async isScannedPdf(storageKey: string, thresholdCharsPerPage: number = 50): Promise<boolean> {
    try {
      const fileBuffer = await this.getFileBuffer(storageKey);
      const pdfData = await pdfParse(fileBuffer);

      const totalPages = pdfData.numpages;
      const fullText = pdfData.text || '';

      // If no pages or no text, consider it scanned
      if (totalPages === 0 || fullText.length === 0) {
        return true;
      }

      // Calculate average characters per page
      const avgCharsPerPage = fullText.length / totalPages;

      // If average is below threshold, consider it scanned
      return avgCharsPerPage < thresholdCharsPerPage;
    } catch (error) {
      // If parsing fails, assume it might be scanned
      console.error('Error checking if PDF is scanned:', error);
      return true;
    }
  }
}
