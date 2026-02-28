import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageServiceToken, IStorageService } from '../storage/storage.module';
import { createWorker } from 'tesseract.js';
import { fromPath } from 'pdf2pic';
import pdfParse from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface OcrPageResult {
  pageNumber: number;
  text: string;
}

export interface OcrResult {
  fullText: string;
  pages: OcrPageResult[];
  totalPages: number;
}

@Injectable()
export class OcrService {
  private readonly ocrLanguage: string;
  private readonly tempDir: string;

  constructor(
    @Inject(StorageServiceToken)
    private storageService: IStorageService,
    private configService: ConfigService,
  ) {
    // Get OCR language from config (default: 'eng' for English)
    this.ocrLanguage = this.configService.get<string>('OCR_LANGUAGE', 'eng');
    // Create temp directory for PDF to image conversion
    this.tempDir = path.join(os.tmpdir(), 'contractai-ocr');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Extract text from PDF using OCR
   */
  async extractTextFromPdf(
    storageKey: string,
    options?: { signal?: AbortSignal },
  ): Promise<OcrResult> {
    // Get PDF buffer from storage
    const pdfBuffer = await this.storageService.getFileBuffer(storageKey, {
      signal: options?.signal,
    });

    // Convert PDF to images
    const images = await this.convertPdfToImages(pdfBuffer);

    try {
      // Initialize Tesseract worker
      const worker = await createWorker(this.ocrLanguage);

      const pages: OcrPageResult[] = [];
      let fullText = '';

      // Process each page
      for (let i = 0; i < images.length; i++) {
        const imagePath = images[i];
        const pageNumber = i + 1;

        try {
          // Perform OCR on image
          const { data } = await worker.recognize(imagePath);
          const pageText = data.text.trim();

          pages.push({
            pageNumber,
            text: pageText,
          });

          fullText += (fullText ? '\n\n' : '') + `--- Page ${pageNumber} ---\n${pageText}`;
        } catch (error) {
          console.error(`Error processing page ${pageNumber}:`, error);
          // Continue with other pages even if one fails
          pages.push({
            pageNumber,
            text: '',
          });
        }
      }

      // Terminate worker
      await worker.terminate();

      // Clean up temporary image files
      this.cleanupTempFiles(images);

      return {
        fullText,
        pages,
        totalPages: images.length,
      };
    } catch (error) {
      // Clean up temporary files on error
      this.cleanupTempFiles(images);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract text from a single image using OCR
   */
  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    const worker = await createWorker(this.ocrLanguage);

    try {
      const { data } = await worker.recognize(imageBuffer);
      return data.text.trim();
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Convert PDF buffer to array of image file paths
   */
  private async convertPdfToImages(pdfBuffer: Buffer): Promise<string[]> {
    // Create temporary PDF file
    const tempPdfPath = path.join(this.tempDir, `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    try {
      // Get PDF info to determine page count
      const pdfData = await pdfParse(pdfBuffer);
      const totalPages = pdfData.numpages;

      // Configure pdf2pic
      const convert = fromPath(tempPdfPath, {
        density: 300, // DPI for better OCR quality
        saveFilename: 'page',
        savePath: this.tempDir,
        format: 'png',
        width: 2000, // Max width to maintain quality
        height: 2000, // Max height
      });

      const imagePaths: string[] = [];

      // Convert each page
      for (let page = 1; page <= totalPages; page++) {
        try {
          const result = await convert(page, { responseType: 'image' });
          if (result && result.path) {
            imagePaths.push(result.path);
          } else {
            console.warn(`No path returned for page ${page}`);
          }
        } catch (pageError) {
          console.error(`Error converting page ${page}:`, pageError);
          // Continue with other pages
        }
      }

      // Clean up temporary PDF file
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }

      if (imagePaths.length === 0) {
        throw new Error('No pages were converted to images');
      }

      return imagePaths;
    } catch (error) {
      // Clean up temporary PDF file on error
      if (fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath);
        } catch (unlinkError) {
          console.error('Error deleting temp PDF:', unlinkError);
        }
      }
      throw new Error(`PDF to image conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clean up temporary image files
   */
  private cleanupTempFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Failed to delete temp file ${filePath}:`, error);
      }
    }
  }
}
