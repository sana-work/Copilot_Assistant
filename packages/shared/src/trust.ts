import { CURRENT_SCHEMA_VERSION, PROJECT_NAME } from "./constants.js";
import type { TrustMetadata } from "./models.js";

export interface TrustMetadataOptions {
  policyId?: string;
  artifactKind?: string;
  source?: string;
  localOnly?: boolean;
  telemetryEnabled?: boolean;
}

export function createTrustMetadata(options: TrustMetadataOptions = {}): TrustMetadata {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    generatedBy: PROJECT_NAME,
    policyId: options.policyId ?? "default-safety-policy",
    localOnly: options.localOnly ?? true,
    telemetryEnabled: options.telemetryEnabled ?? false,
    artifactKind: options.artifactKind,
    source: options.source
  };
}
