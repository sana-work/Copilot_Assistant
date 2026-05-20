import type { FeaturePlanArtifact } from "./models.js";

export function renderFeaturePlanMarkdown(plan: FeaturePlanArtifact): string {
  return [
    `# ${plan.title}`,
    "",
    `**Status:** ${plan.status}`,
    `**Requires human approval:** ${plan.requiresHumanApproval ? "yes" : "no"}`,
    "",
    "## Request Interpretation",
    plan.requestInterpretation,
    "",
    "## Repo Architecture Summary",
    plan.repoArchitectureSummary,
    "",
    "## Planning Context",
    renderBullets([
      `Workspace repo roots: ${plan.planningContext.workspaceRepoRoots.join(", ") || "current repo"}`,
      `Custom commands: ${plan.planningContext.customCommandNames.join(", ") || "none detected"}`,
      `Instruction files: ${plan.planningContext.instructionFiles.join(", ") || "none detected"}`
    ]),
    "",
    "## Relevant Files",
    renderFileReferences(plan.relevantFiles),
    "",
    "## Similar Feature Candidates",
    renderFileReferences(plan.similarFeatureCandidates),
    "",
    "## Impacted Languages And Frameworks",
    renderBullets([
      `Languages: ${plan.impactedLanguages.join(", ") || "unknown"}`,
      `Frameworks: ${plan.impactedFrameworks.join(", ") || "none detected"}`
    ]),
    "",
    "## Impacted Modules And Folders",
    renderBullets(plan.impactedModules),
    "",
    "## Likely Files To Modify",
    renderBullets(plan.likelyFilesToModify),
    "",
    "## Likely New Files",
    renderBullets(plan.likelyNewFiles),
    "",
    "## Frontend/UI Impact",
    renderBullets(plan.frontendImpact),
    "",
    "## Backend/API Impact",
    renderBullets(plan.backendImpact),
    "",
    "## Data/Config Impact",
    renderBullets(plan.dataConfigImpact),
    "",
    "## Security Considerations",
    renderBullets(plan.securityConsiderations),
    "",
    "## Performance Considerations",
    renderBullets(plan.performanceConsiderations),
    "",
    "## Test Strategy",
    renderBullets(plan.testStrategy),
    "",
    "## Validation Commands",
    renderBullets(
      plan.validationPlan.commands.map((command) =>
        [command.command, ...command.args].join(" ")
      )
    ),
    "",
    "## Step-by-Step Implementation Plan",
    renderNumbered(
      plan.implementationSteps.map((step) => `${step.title}: ${step.details}`)
    ),
    "",
    "## Stack-Specific Plan",
    renderStackSpecificPlan(plan),
    "",
    "## Risks",
    renderBullets(
      plan.impactAnalysis.risks.map((risk) =>
        risk.mitigation
          ? `${risk.title}: ${risk.details} Mitigation: ${risk.mitigation}`
          : `${risk.title}: ${risk.details}`
      )
    ),
    "",
    "## Assumptions",
    renderBullets(plan.assumptions),
    "",
    "## Open Questions",
    renderBullets(plan.openQuestions),
    "",
    "## Human Approval Checkpoint",
    plan.humanApprovalCheckpoint,
    ""
  ].join("\n");
}

function renderFileReferences(files: { filePath: string; reason: string }[]): string {
  if (files.length === 0) {
    return "- None identified yet.";
  }

  return files.map((file) => `- \`${file.filePath}\`: ${file.reason}`).join("\n");
}

function renderBullets(values: string[]): string {
  if (values.length === 0) {
    return "- None identified yet.";
  }

  return values.map((value) => `- ${value}`).join("\n");
}

function renderNumbered(values: string[]): string {
  if (values.length === 0) {
    return "1. No implementation steps identified yet.";
  }

  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function renderStackSpecificPlan(plan: FeaturePlanArtifact): string {
  return [
    "### React",
    renderBullets(plan.stackSpecificPlan.react),
    "",
    "### Angular",
    renderBullets(plan.stackSpecificPlan.angular),
    "",
    "### Python",
    renderBullets(plan.stackSpecificPlan.python),
    "",
    "### Java",
    renderBullets(plan.stackSpecificPlan.java),
    "",
    "### Generic",
    renderBullets(plan.stackSpecificPlan.generic)
  ].join("\n");
}
