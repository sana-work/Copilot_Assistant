import type { FeaturePlan, ValidationCommand } from "@copilot-architect/shared";

import type { SearchResult } from "@copilot-architect/indexer";

export interface FeaturePlanningOptions {
  request: string;
  startPath?: string;
  searchLimit?: number;
}

export interface FeaturePlanningResult {
  repoRoot: string;
  plan: FeaturePlanArtifact;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
  latestJsonPath: string;
  latestMarkdownPath: string;
  searchResults: SearchResult[];
}

export interface FeaturePlanArtifact extends FeaturePlan {
  requestInterpretation: string;
  repoArchitectureSummary: string;
  planningContext: PlanningContextSummary;
  relevantFiles: PlanFileReference[];
  similarFeatureCandidates: PlanFileReference[];
  impactedLanguages: string[];
  impactedFrameworks: string[];
  impactedModules: string[];
  likelyFilesToModify: string[];
  likelyNewFiles: string[];
  frontendImpact: string[];
  backendImpact: string[];
  dataConfigImpact: string[];
  securityConsiderations: string[];
  performanceConsiderations: string[];
  testStrategy: string[];
  openQuestions: string[];
  humanApprovalCheckpoint: string;
  stackSpecificPlan: StackSpecificPlan;
}

export interface PlanFileReference {
  filePath: string;
  reason: string;
  score?: number;
}

export interface StackSpecificPlan {
  react: string[];
  angular: string[];
  python: string[];
  java: string[];
  generic: string[];
}

export interface PlanningContextSummary {
  workspaceRepoRoots: string[];
  customCommandCount: number;
  customCommandNames: string[];
  instructionFiles: string[];
}

export interface PlanArtifactPaths {
  timestampJsonPath: string;
  timestampMarkdownPath: string;
  latestJsonPath: string;
  latestMarkdownPath: string;
}

export interface ValidationCommandCandidate {
  command: ValidationCommand;
  label: string;
}
