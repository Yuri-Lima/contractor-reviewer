import { MigrationInterface, QueryRunner } from 'typeorm';

const CHAT_SYSTEM_NEW =
  'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. Cite sources using **Document Excerpt N** or `Document Excerpt N`, not link syntax. IMPORTANT: When a language is specified, provide all answers in that language.';

const CHAT_USER_NEW = `You are a legal assistant analyzing contracts. Answer the question based ONLY on the provided context. If the context doesn't contain enough information, say "NOT FOUND" and suggest where to look.

IMPORTANT: You MUST provide your answer in {{languageName}}. All responses must be written in {{languageName}}.

Context:
{{context}}

Question: {{question}}

Answer (be concise and cite specific excerpts, respond in {{languageName}}). When citing excerpts, use **Document Excerpt N** (bold) or \`Document Excerpt N\` (inline code). Do NOT use markdown link syntax like [Document Excerpt N][document excerpt n].`;

/**
 * Updates global chat prompts with citation format instructions so that
 * [Document Excerpt N][document excerpt n] malformed markdown renders correctly.
 */
export class AddChatCitationFormatInstructions1784000000000
  implements MigrationInterface
{
  name = 'AddChatCitationFormatInstructions1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "prompts" SET "content" = $1, "updatedAt" = now() WHERE "key" = 'chat.system' AND "workspaceId" IS NULL AND "documentId" IS NULL`,
      [CHAT_SYSTEM_NEW],
    );
    await queryRunner.query(
      `UPDATE "prompts" SET "content" = $1, "updatedAt" = now() WHERE "key" = 'chat.user' AND "workspaceId" IS NULL AND "documentId" IS NULL`,
      [CHAT_USER_NEW],
    );
  }

  public async down(): Promise<void> {
    // No down migration - reverting would require storing old content
  }
}
