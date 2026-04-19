import type { DocumentPromptKey } from './prompts';
import { PROMPT_KEYS } from './prompts';

/** Base prompts used by the "general" category (matches built-in defaults) */
const GENERAL_PROMPTS: Record<DocumentPromptKey, string> = {
  'chat.system':
    'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. Cite sources using **Document Excerpt N** or `Document Excerpt N`, not link syntax. IMPORTANT: When a language is specified, provide all answers in that language.',
  'chat.user': `You are a legal assistant analyzing contracts. Answer the question based ONLY on the provided context. If the context doesn't contain enough information, say "NOT FOUND" and suggest where to look.

IMPORTANT: You MUST provide your answer in {{languageName}}. All responses must be written in {{languageName}}.

Context:
{{context}}

Question: {{question}}

Answer (be concise and cite specific excerpts, respond in {{languageName}}). When citing excerpts, use **Document Excerpt N** (bold) or \`Document Excerpt N\` (inline code). Do NOT use markdown link syntax like [Document Excerpt N][document excerpt n].`,
};

/** Domain prefix helper: prepends domain context to the base system prompt */
function withDomain(
  base: Record<DocumentPromptKey, string>,
  domainPrefix: string,
): Record<DocumentPromptKey, string> {
  return {
    ...base,
    'chat.system': `${domainPrefix}\n\n${base['chat.system']}`,
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

// Validate at module load: each category has all required keys
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
