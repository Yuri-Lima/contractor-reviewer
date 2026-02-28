import { Module } from '@nestjs/common';
import { TypeOrmModule, } from '@nestjs/typeorm';
import { Chunk } from '../entities/chunk.entity';
import { TypeOrmChunkRepository } from './chunk.repository';
import { CHUNK_REPOSITORY } from './chunk-repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Chunk])],
  providers: [
    {
      provide: CHUNK_REPOSITORY,
      useClass: TypeOrmChunkRepository,
    },
  ],
  exports: [CHUNK_REPOSITORY],
})
export class ChunksModule {}
