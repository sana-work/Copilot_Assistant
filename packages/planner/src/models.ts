import type {
  DetectedCommand,
  FeaturePlan,
  ValidationCommand
} from "@copilot-architect/shared";
import type { WorkspaceRepoDescriptor } from "@copilot-architect/core";

import type { SearchResult, WorkspaceSearchResult } from "@copilot-architect/indexer";

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

export interface FeaturePlanPreviewResult {
  repoRoot: string;
  plan: FeaturePlanArtifact;
  markdown: string;
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
  multiRepo?: WorkspacePlanSummary;
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

export type WorkspacePlanningOptions = FeaturePlanningOptions;

export interface WorkspaceImpactResult {
  request: string;
  workspaceName?: string;
  workspaceRoot: string;
  repos: WorkspaceRepoDescriptor[];
  impactedRepos: WorkspaceImpactedRepo[];
  perRepoValidationPlans: WorkspaceRepoValidationPlan[];
}

export interface WorkspaceImpactedRepo {
  name: string;
  role?: string;
  repoRoot: string;
  resultCount: number;
  topScore: number;
  topFiles: string[];
}

export interface WorkspaceRepoValidationPlan {
  repoName: string;
  repoRole?: string;
  repoRoot: string;
  commands: DetectedCommand[];
  strategy: string;
}

export interface WorkspacePlanSummary extends WorkspaceImpactResult {
  searchResults: WorkspaceSearchResult[];
}

export interface WorkspacePlanningResult extends FeaturePlanningResult {
  multiRepo: WorkspacePlanSummary;
}

export interface WorkspacePlanPreviewResult extends FeaturePlanPreviewResult {
  multiRepo: WorkspacePlanSummary;
}
