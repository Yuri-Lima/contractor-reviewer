import { Module } from '@nestjs/common';
import { FileTypeDetectionService } from './file-type-detection.service';

@Module({
  providers: [FileTypeDetectionService],
  exports: [FileTypeDetectionService],
})
export class FileTypeModule {}
