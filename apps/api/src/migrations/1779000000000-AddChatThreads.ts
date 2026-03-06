import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Chat threads: create chat_threads table, truncate chat_messages, add threadId + role.
 * Data loss on chat_messages acceptable per product decision.
 */
export class AddChatThreads1779000000000 implements MigrationInterface {
  name = 'AddChatThreads1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create chat_threads table
    await queryRunner.createTable(
      new Table({
        name: 'chat_threads',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'documentId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'workspaceId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            isNullable: true,
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
      'chat_threads',
      new TableIndex({
        name: 'IDX_chat_threads_documentId_updatedAt',
        columnNames: ['documentId', 'updatedAt'],
      }),
    );
    await queryRunner.createIndex(
      'chat_threads',
      new TableIndex({
        name: 'IDX_chat_threads_workspaceId_userId',
        columnNames: ['workspaceId', 'userId'],
      }),
    );

    await queryRunner.createForeignKey(
      'chat_threads',
      new TableForeignKey({
        columnNames: ['documentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'documents',
        onDelete: 'CASCADE',
      }),
    );

    // 2. Truncate existing chat_messages
    await queryRunner.query(`TRUNCATE TABLE "chat_messages" CASCADE`);

    // 3. Drop existing FK from documentId (we'll recreate after adding threadId)
    const chatMessagesTable = await queryRunner.getTable('chat_messages');
    const documentFk = chatMessagesTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('documentId') !== -1,
    );
    if (documentFk) {
      await queryRunner.dropForeignKey('chat_messages', documentFk);
    }

    // 4. Add threadId and role columns
    await queryRunner.query(`ALTER TABLE "chat_messages" ADD COLUMN "threadId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD COLUMN "role" varchar(20) NOT NULL DEFAULT 'user'`,
    );

    // 5. Add FK for threadId
    await queryRunner.createForeignKey(
      'chat_messages',
      new TableForeignKey({
        columnNames: ['threadId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'chat_threads',
        onDelete: 'CASCADE',
      }),
    );

    // 6. Make threadId NOT NULL (table is empty so safe)
    await queryRunner.query(`ALTER TABLE "chat_messages" ALTER COLUMN "threadId" SET NOT NULL`);

    // 7. Recreate documentId FK
    await queryRunner.createForeignKey(
      'chat_messages',
      new TableForeignKey({
        columnNames: ['documentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'documents',
        onDelete: 'CASCADE',
      }),
    );

    // 8. Index for threadId (for getMessages)
    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'IDX_chat_messages_threadId',
        columnNames: ['threadId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop threadId index
    await queryRunner.dropIndex('chat_messages', 'IDX_chat_messages_threadId');

    // Drop threadId FK
    const chatMessagesTable = await queryRunner.getTable('chat_messages');
    const threadFk = chatMessagesTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('threadId') !== -1,
    );
    if (threadFk) {
      await queryRunner.dropForeignKey('chat_messages', threadFk);
    }

    // Remove threadId and role columns
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "threadId"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "role"`);

    // Drop chat_threads
    const threadsTable = await queryRunner.getTable('chat_threads');
    const threadsDocumentFk = threadsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('documentId') !== -1,
    );
    if (threadsDocumentFk) {
      await queryRunner.dropForeignKey('chat_threads', threadsDocumentFk);
    }
    await queryRunner.dropTable('chat_threads');
  }
}
