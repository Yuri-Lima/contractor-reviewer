import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptsTable1770600000000 implements MigrationInterface {
  name = 'AddPromptsTable1770600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "prompts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying(100) NOT NULL,
        "variant" character varying(50) NOT NULL DEFAULT 'default',
        "workspaceId" uuid,
        "content" text NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prompts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompts_global" ON "prompts" ("key", "variant") WHERE "workspaceId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompts_workspace" ON "prompts" ("key", "variant", "workspaceId") WHERE "workspaceId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_prompts_key" ON "prompts" ("key")
    `);

    // Seed default prompts (workspaceId = null for global)
    const defaultPrompts = [
      {
        key: 'chat.system',
        content:
          'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. Cite sources using **Document Excerpt N** or `Document Excerpt N`, not link syntax. IMPORTANT: When a language is specified, provide all answers in that language.',
        metadata: JSON.stringify({ description: 'System prompt for RAG chat', requiredVariables: ['languageName'] }),
      },
      {
        key: 'chat.user',
        content: `You are a legal assistant analyzing contracts. Answer the question based ONLY on the provided context. If the context doesn't contain enough information, say "NOT FOUND" and suggest where to look.

IMPORTANT: You MUST provide your answer in {{languageName}}. All responses must be written in {{languageName}}.

Context:
{{context}}

Question: {{question}}

Answer (be concise and cite specific excerpts, respond in {{languageName}}). When citing excerpts, use **Document Excerpt N** (bold) or \`Document Excerpt N\` (inline code). Do NOT use markdown link syntax like [Document Excerpt N][document excerpt n].`,
        metadata: JSON.stringify({ description: 'User prompt template for RAG chat', requiredVariables: ['languageName', 'context', 'question'] }),
      },
      {
        key: 'redline.system',
        content:
          'You are a legal assistant. Provide structured, evidence-based contract revisions. Always use conditional language and cite sources. Never provide legal advice. IMPORTANT: When a language is specified, provide all explanations in that language.',
        metadata: JSON.stringify({ description: 'System prompt for redline generation', requiredVariables: ['languageName'] }),
      },
      {
        key: 'redline.user',
        content: `You are a legal assistant helping to revise contract clauses. Your task is to suggest improvements to the selected text while maintaining legal accuracy and professional tone.

IMPORTANT: You MUST provide all responses, especially the "explanation" field, in {{languageName}}. All explanations, suggestions, and comments must be written in {{languageName}}.

{{playbookPrompt}}

Selected Text to Revise:
"{{selectedText}}"

Context from Contract and Legal Sources:
{{context}}

{{objective}}{{instructions}}

IMPORTANT RULES:
- NEVER say "this is illegal", "you must", or "you should"
- ALWAYS use conditional language ("may", "could", "depending on", "consider")
- NEVER provide legal advice or make absolute statements
- ALWAYS cite specific excerpts from the contract or legal sources
- If you cannot find sufficient evidence, respond with "NOT FOUND" and explain what was searched
- RESPOND IN {{languageName}}: All explanations must be in {{languageName}}

Please provide:
1. A revised version of the selected text (suggestedText) - keep original language of the contract
2. A clear explanation of why the change was suggested (explanation) - MUST be in {{languageName}}
3. Specific citations from the contract (citations)
4. Legal citations if relevant (legalCitations)

Format your response as JSON:
{
  "suggestedText": "...",
  "explanation": "...",
  "citations": [
    {
      "kind": "contract",
      "file": "...",
      "page": 12,
      "spanId": "...",
      "quoteSnippet": "..."
    }
  ],
  "legalCitations": [
    {
      "kind": "legal",
      "source": "...",
      "section": "...",
      "url": "..."
    }
  ]
}`,
        metadata: JSON.stringify({
          description: 'User prompt template for redline',
          requiredVariables: ['languageName', 'playbookPrompt', 'selectedText', 'context', 'objective', 'instructions'],
        }),
      },
      {
        key: 'redline.playbook.balanced',
        content: `Playbook: BALANCED
- Balance risks and benefits for all parties
- Use neutral, professional language
- Suggest improvements that enhance clarity and fairness
- Consider both parties' interests equally`,
        metadata: JSON.stringify({ description: 'Balanced redline playbook' }),
      },
      {
        key: 'redline.playbook.conservative',
        content: `Playbook: CONSERVATIVE
- Minimize changes to the original text
- Focus on clarity and precision
- Use neutral, professional language
- Only suggest changes that improve clarity without changing meaning
- Avoid favoritism toward any party`,
        metadata: JSON.stringify({ description: 'Conservative redline playbook' }),
      },
      {
        key: 'redline.playbook.client-friendly',
        content: `Playbook: CLIENT_FRIENDLY
- Suggest changes that are more favorable to the client/user
- However, remain professional and defensible
- Avoid extreme language or absolute guarantees
- Ensure suggestions are plausible and reasonable
- Balance client interests with legal soundness`,
        metadata: JSON.stringify({ description: 'Client-friendly redline playbook' }),
      },
    ];

    for (const p of defaultPrompts) {
      await queryRunner.query(
        `INSERT INTO "prompts" ("key", "variant", "content", "metadata") VALUES ($1, 'default', $2, $3)`,
        [p.key, p.content, p.metadata],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "prompts" CASCADE`);
  }
}
