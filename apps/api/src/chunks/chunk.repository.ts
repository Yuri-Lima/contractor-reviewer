import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chunk } from '../entities/chunk.entity';
import {
  IChunkRepository,
  CreateChunkDto,
} from './chunk-repository.interface';

@Injectable()
export class TypeOrmChunkRepository implements IChunkRepository {
  constructor(
    @InjectRepository(Chunk)
    private readonly chunkRepository: Repository<Chunk>,
  ) {}

  async create(data: CreateChunkDto[]): Promise<Chunk[]> {
    const entities = data.map((d) =>
      this.chunkRepository.create({
        documentId: d.documentId,
        text: d.text,
        pageNumber: d.pageNumber,
        paragraphId: d.paragraphId,
        startIndex: d.startIndex,
        endIndex: d.endIndex,
      }),
    );
    return this.chunkRepository.save(entities);
  }

  async findByDocumentId(documentId: string): Promise<Chunk[]> {
    return this.chunkRepository.find({
      where: { documentId },
      order: {
        pageNumber: 'ASC',
        startIndex: 'ASC',
      },
    });
  }

  async deleteByDocumentId(documentId: string): Promise<number> {
    const result = await this.chunkRepository
      .createQueryBuilder()
      .delete()
      .where('documentId = :documentId', { documentId })
      .execute();
    return result.affected ?? 0;
  }

  async findByIds(ids: string[]): Promise<Chunk[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.chunkRepository
      .createQueryBuilder('chunk')
      .whereInIds(ids)
      .getMany();
  }

  async save(chunks: Chunk[]): Promise<Chunk[]> {
    return this.chunkRepository.save(chunks);
  }
}
