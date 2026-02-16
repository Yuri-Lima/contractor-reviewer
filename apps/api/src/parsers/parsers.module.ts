import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DoclingAdapter } from './adapters/docling.adapter';
import { PdfplumberAdapter } from './adapters/pdfplumber.adapter';
import { Dpt2Adapter } from './adapters/dpt2.adapter';
import { LlamaParseAdapter } from './adapters/llamaparse.adapter';
import { UnstructuredAdapter } from './adapters/unstructured.adapter';
import { ParserFactoryService } from './parser-factory.service';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [ConfigModule, forwardRef(() => WorkspaceModule)],
  providers: [
    DoclingAdapter,
    PdfplumberAdapter,
    Dpt2Adapter,
    LlamaParseAdapter,
    UnstructuredAdapter,
    ParserFactoryService,
  ],
  exports: [ParserFactoryService],
})
export class ParsersModule {}
