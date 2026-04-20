import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebSearchService } from './web-search.service';

@Module({
  imports: [ConfigModule],
  providers: [WebSearchService],
  exports: [WebSearchService],
})
export class WebSearchModule {}
