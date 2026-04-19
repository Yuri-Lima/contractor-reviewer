import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddMemories1782000000000 implements MigrationInterface {
  name = 'AddMemories1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'memories',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'scopeType',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'scopeId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'workspaceId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'memories',
      new TableIndex({
        name: 'IDX_memories_scope',
        columnNames: ['scopeType', 'scopeId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'memories',
      new TableIndex({
        name: 'IDX_memories_workspaceId',
        columnNames: ['workspaceId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('memories', 'IDX_memories_workspaceId');
    await queryRunner.dropIndex('memories', 'IDX_memories_scope');
    await queryRunner.dropTable('memories');
  }
}
