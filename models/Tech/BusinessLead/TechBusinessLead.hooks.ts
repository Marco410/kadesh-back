type LeadInput = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  businessName?: string | null;
  websiteUrl?: string | null;
  hasWebsite?: boolean | null;
};

function resolveFullName(data: LeadInput): string | null | undefined {
  if (data.fullName?.trim()) return data.fullName.trim();

  const fromParts = [data.firstName, data.lastName]
    .filter((part) => part?.trim())
    .join(" ")
    .trim();

  if (fromParts) return fromParts;
  if (data.businessName?.trim()) return data.businessName.trim();

  return data.fullName;
}

function resolveHasWebsite(data: LeadInput): boolean | undefined {
  if (data.hasWebsite != null) return data.hasWebsite;
  if (data.websiteUrl?.trim()) return true;
  return undefined;
}

export const businessLeadHooks = {
  resolveInput: async ({ resolvedData }: { resolvedData: LeadInput }) => {
    const fullName = resolveFullName(resolvedData);
    const hasWebsite = resolveHasWebsite(resolvedData);

    return {
      ...(fullName != null && { fullName }),
      ...(hasWebsite != null && { hasWebsite }),
    };
  },
  afterOperation: async () => {},
};
