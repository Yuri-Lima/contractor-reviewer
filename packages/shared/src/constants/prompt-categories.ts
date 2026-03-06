import type { DocumentPromptKey } from './prompts';
import { PROMPT_KEYS } from './prompts';

/** Base prompts used by the "general" category (matches built-in defaults) */
const GENERAL_PROMPTS: Record<DocumentPromptKey, string> = {
  'chat.system':
    'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. IMPORTANT: When a language is specified, provide all answers in that language.',
  'chat.user': `You are a legal assistant analyzing contracts. Answer the question based ONLY on the provided context. If the context doesn't contain enough information, say "NOT FOUND" and suggest where to look.

IMPORTANT: You MUST provide your answer in {{languageName}}. All responses must be written in {{languageName}}.

Context:
{{context}}

Question: {{question}}

Answer (be concise and cite specific excerpts, respond in {{languageName}}):`,
  'redline.system':
    'You are a legal assistant. Provide structured, evidence-based contract revisions. Always use conditional language and cite sources. Never provide legal advice. IMPORTANT: When a language is specified, provide all explanations in that language.',
  'redline.user': `You are a legal assistant helping to revise contract clauses. Your task is to suggest improvements to the selected text while maintaining legal accuracy and professional tone.

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
  'redline.playbook.balanced': `Playbook: BALANCED
- Balance risks and benefits for all parties
- Use neutral, professional language
- Suggest improvements that enhance clarity and fairness
- Consider both parties' interests equally`,
  'redline.playbook.conservative': `Playbook: CONSERVATIVE
- Minimize changes to the original text
- Focus on clarity and precision
- Use neutral, professional language
- Only suggest changes that improve clarity without changing meaning
- Avoid favoritism toward any party`,
  'redline.playbook.client-friendly': `Playbook: CLIENT_FRIENDLY
- Suggest changes that are more favorable to the client/user
- However, remain professional and defensible
- Avoid extreme language or absolute guarantees
- Ensure suggestions are plausible and reasonable
- Balance client interests with legal soundness`,
};

/** Domain prefix helper: prepends domain context to the base system prompt */
function withDomain(
  base: Record<DocumentPromptKey, string>,
  domainPrefix: string,
): Record<DocumentPromptKey, string> {
  return {
    ...base,
    'chat.system': `${domainPrefix}\n\n${base['chat.system']}`,
    'redline.system': `${domainPrefix}\n\n${base['redline.system']}`,
  };
}

export interface PromptCategory {
  id: string;
  nameKey: string;
  descriptionKey?: string;
  prompts: Record<DocumentPromptKey, string>;
}

/** Category ID that enables Legal RAG when combined with resolvedJurisdiction */
export const LEGAL_RAG_CATEGORY_ID = 'legal-law';

/** All available prompt categories. Each provides prompts for all 7 document keys. */
export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: 'general',
    nameKey: 'promptCategories.general',
    descriptionKey: 'promptCategories.generalDescription',
    prompts: { ...GENERAL_PROMPTS },
  },
  {
    id: LEGAL_RAG_CATEGORY_ID,
    nameKey: 'promptCategories.legalLaw',
    descriptionKey: 'promptCategories.legalLawDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: General legal practice, contract law, statutory interpretation, legal terminology, jurisdiction awareness. Apply principles of contract construction and governing law analysis.',
    ),
  },
  {
    id: 'real-estate',
    nameKey: 'promptCategories.realEstate',
    descriptionKey: 'promptCategories.realEstateDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Real estate contracts, leases, property rights, zoning, title, disclosures. Consider local real estate law and regulatory requirements.',
    ),
  },
  {
    id: 'employment',
    nameKey: 'promptCategories.employment',
    descriptionKey: 'promptCategories.employmentDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Employment contracts, non-compete agreements, confidentiality, termination clauses, labor law, benefits. Consider applicable employment statutes.',
    ),
  },
  {
    id: 'nda',
    nameKey: 'promptCategories.nda',
    descriptionKey: 'promptCategories.ndaDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: NDAs, confidentiality agreements, trade secrets, information disclosure. Pay attention to carve-outs, exceptions, and term of confidentiality.',
    ),
  },
  {
    id: 'commercial',
    nameKey: 'promptCategories.commercial',
    descriptionKey: 'promptCategories.commercialDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Commercial contracts, vendor agreements, supply agreements, purchase orders. Consider UCC where applicable, warranties, and indemnification.',
    ),
  },
  {
    id: 'it-software',
    nameKey: 'promptCategories.itSoftware',
    descriptionKey: 'promptCategories.itSoftwareDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Software licenses, SaaS agreements, IP licensing, SLAs, data protection, support terms. Consider open-source compliance and security obligations.',
    ),
  },
  {
    id: 'insurance',
    nameKey: 'promptCategories.insurance',
    descriptionKey: 'promptCategories.insuranceDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Insurance policies, coverage terms, exclusions, claims. Consider regulatory frameworks for insurance contracts.',
    ),
  },
  {
    id: 'banking',
    nameKey: 'promptCategories.banking',
    descriptionKey: 'promptCategories.bankingDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Banking agreements, credit facilities, security agreements, financial regulations. Consider jurisdiction-specific banking law.',
    ),
  },
  {
    id: 'construction',
    nameKey: 'promptCategories.construction',
    descriptionKey: 'promptCategories.constructionDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Construction contracts, subcontracts, change orders, lien waivers, bonds. Consider AIA/consensus docs and local construction law.',
    ),
  },
  {
    id: 'healthcare',
    nameKey: 'promptCategories.healthcare',
    descriptionKey: 'promptCategories.healthcareDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Healthcare contracts, HIPAA, BAA, medical services, provider agreements. Consider healthcare regulatory compliance.',
    ),
  },
  {
    id: 'ma-corporate',
    nameKey: 'promptCategories.maCorporate',
    descriptionKey: 'promptCategories.maCorporateDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: M&A, acquisition agreements, representations and warranties, due diligence. Consider corporate governance and securities law.',
    ),
  },
  {
    id: 'intellectual-property',
    nameKey: 'promptCategories.intellectualProperty',
    descriptionKey: 'promptCategories.intellectualPropertyDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: IP licensing, patent, trademark, copyright assignments. Consider ownership, royalty, and infringement provisions.',
    ),
  },
  {
    id: 'litigation-dispute',
    nameKey: 'promptCategories.litigationDispute',
    descriptionKey: 'promptCategories.litigationDisputeDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Settlement agreements, dispute resolution, arbitration, mediation clauses. Consider enforceability and waiver of claims.',
    ),
  },
  {
    id: 'regulatory-compliance',
    nameKey: 'promptCategories.regulatoryCompliance',
    descriptionKey: 'promptCategories.regulatoryComplianceDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Compliance agreements, regulatory obligations, certifications. Consider industry-specific regulations and reporting.',
    ),
  },
  {
    id: 'government-public-sector',
    nameKey: 'promptCategories.governmentPublicSector',
    descriptionKey: 'promptCategories.governmentPublicSectorDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Government contracts, RFPs, procurement, public sector requirements. Consider FAR, state procurement rules, and audit clauses.',
    ),
  },
  {
    id: 'energy-utilities',
    nameKey: 'promptCategories.energyUtilities',
    descriptionKey: 'promptCategories.energyUtilitiesDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Energy contracts, utility agreements, power purchase, renewables. Consider sector-specific regulations and grid requirements.',
    ),
  },
  {
    id: 'telecommunications',
    nameKey: 'promptCategories.telecommunications',
    descriptionKey: 'promptCategories.telecommunicationsDescription',
    prompts: withDomain(
      GENERAL_PROMPTS,
      'Focus: Telecom agreements, service level agreements, spectrum, interconnection. Consider FCC and local regulatory frameworks.',
    ),
  },
];

/** Valid category ids for validation */
export const PROMPT_CATEGORY_IDS = PROMPT_CATEGORIES.map((c) => c.id);

/** Get a prompt category by id, or null if not found */
export function getPromptCategoryById(
  id: string | null | undefined,
): PromptCategory | null {
  if (id == null || id === '') return null;
  return PROMPT_CATEGORIES.find((c) => c.id === id) ?? null;
}

// Validate at module load: each category has all 7 keys
const REQUIRED_KEYS = new Set(PROMPT_KEYS);
for (const cat of PROMPT_CATEGORIES) {
  for (const key of REQUIRED_KEYS) {
    if (typeof cat.prompts[key] !== 'string') {
      throw new Error(
        `Prompt category "${cat.id}" missing required key "${key}"`,
      );
    }
  }
}
