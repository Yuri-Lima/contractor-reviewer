import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';
import { PgVectorStore } from './pgvector-store.service';
import { VECTOR_STORE } from './vector-store.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Chunk, Embedding])],
  providers: [{ provide: VECTOR_STORE, useClass: PgVectorStore }],
  exports: [VECTOR_STORE],
})
export class VectorStoreModule {}
