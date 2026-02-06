import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddChatMessagesAndVersions1700000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create chat_messages table
    await queryRunner.createTable(
      new Table({
        name: 'chat_messages',
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
            name: 'question',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'answerText',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'confidence',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'citations',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notFound',
            type: 'boolean',
            default: false,
          },
          {
            name: 'jurisdiction',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create indexes for chat_messages
    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'IDX_chat_messages_documentId',
        columnNames: ['documentId'],
      }),
    );
    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'IDX_chat_messages_workspaceId',
        columnNames: ['workspaceId'],
      }),
    );
    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'IDX_chat_messages_userId',
        columnNames: ['userId'],
      }),
    );

    // Create foreign key for chat_messages
    await queryRunner.createForeignKey(
      'chat_messages',
      new TableForeignKey({
        columnNames: ['documentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'documents',
        onDelete: 'CASCADE',
      }),
    );

    // Create document_versions table
    await queryRunner.createTable(
      new Table({
        name: 'document_versions',
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
            name: 'versionNumber',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'playbook',
            type: 'enum',
            enum: ['balanced', 'conservative', 'client-friendly'],
            isNullable: true,
          },
          {
            name: 'instructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'changes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'prompt',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create indexes for document_versions
    await queryRunner.createIndex(
      'document_versions',
      new TableIndex({
        name: 'IDX_document_versions_documentId',
        columnNames: ['documentId'],
      }),
    );
    await queryRunner.createIndex(
      'document_versions',
      new TableIndex({
        name: 'IDX_document_versions_workspaceId',
        columnNames: ['workspaceId'],
      }),
    );
    await queryRunner.createIndex(
      'document_versions',
      new TableIndex({
        name: 'IDX_document_versions_userId',
        columnNames: ['userId'],
      }),
    );

    // Create foreign key for document_versions
    await queryRunner.createForeignKey(
      'document_versions',
      new TableForeignKey({
        columnNames: ['documentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'documents',
        onDelete: 'CASCADE',
      }),
    );

    // Add noLogsConfig column to workspace_settings if it doesn't exist
    const workspaceSettingsTable = await queryRunner.getTable('workspace_settings');
    const noLogsConfigColumn = workspaceSettingsTable?.findColumnByName('noLogsConfig');
    if (!noLogsConfigColumn) {
      await queryRunner.query(
        `ALTER TABLE "workspace_settings" ADD COLUMN "noLogsConfig" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const chatMessagesTable = await queryRunner.getTable('chat_messages');
    const chatMessagesFk = chatMessagesTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('documentId') !== -1,
    );
    if (chatMessagesFk) {
      await queryRunner.dropForeignKey('chat_messages', chatMessagesFk);
    }

    const versionsTable = await queryRunner.getTable('document_versions');
    const versionsFk = versionsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('documentId') !== -1,
    );
    if (versionsFk) {
      await queryRunner.dropForeignKey('document_versions', versionsFk);
    }

    // Drop tables
    await queryRunner.dropTable('chat_messages');
    await queryRunner.dropTable('document_versions');

    // Remove noLogsConfig column
    const workspaceSettingsTable = await queryRunner.getTable('workspace_settings');
    const noLogsConfigColumn = workspaceSettingsTable?.findColumnByName('noLogsConfig');
    if (noLogsConfigColumn) {
      await queryRunner.query(`ALTER TABLE "workspace_settings" DROP COLUMN "noLogsConfig"`);
    }
  }
}
