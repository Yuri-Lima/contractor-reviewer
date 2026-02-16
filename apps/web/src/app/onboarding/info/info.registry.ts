export interface InfoEntry {
  titleKey: string;
  shortKey: string;
  longKeys?: string[];
  links?: { labelKey: string; route?: string }[];
}

export const INFO_REGISTRY: Record<string, InfoEntry> = {
  confidence_score: {
    titleKey: 'onboarding.info.confidenceScore.title',
    shortKey: 'onboarding.info.confidenceScore.short',
    longKeys: [
      'onboarding.info.confidenceScore.long1',
      'onboarding.info.confidenceScore.long2',
      'onboarding.info.confidenceScore.long3',
    ],
    links: [{ labelKey: 'onboarding.info.confidenceScore.learnMore' }],
  },
  citations: {
    titleKey: 'onboarding.info.citations.title',
    shortKey: 'onboarding.info.citations.short',
    links: [{ labelKey: 'onboarding.info.citations.learnMore' }],
  },
};
