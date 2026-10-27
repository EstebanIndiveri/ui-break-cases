export type VariantId = "broken" | "fixed" | "control";

export type Viewport = {
  width: number;
  height: number;
};

export type Provenance = {
  kind: "original" | "inspired";
  note: string;
  sources: { label: string; href: string }[];
};

export type VariantManifest = {
  id: VariantId;
  label: string;
  path: string;
  expectedBehavior: string;
  summary: string;
  relevantChange: string;
};

export type CaseManifest = {
  id: string;
  title: string;
  failureDescription: string;
  reproductionCondition: string;
  explanation: string;
  viewport: Viewport;
  sharedContent: string;
  variants: Record<VariantId, VariantManifest>;
  provenance: Provenance;
  links: { label: string; href: string }[];
  knownLimitations: string[];
  testFile: string;
  sourceDirectory: string;
};
