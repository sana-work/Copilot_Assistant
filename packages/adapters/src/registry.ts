import { GenericTextAdapter } from "./generic-text-adapter.js";
import { AdapterDetectionResult, mergeAdapterDetectionResults } from "./results.js";
import { AdapterContext, type AdapterContextInput, type IAdapter } from "./types.js";

export interface AdapterRegistryResult {
  context: AdapterContext;
  matchedAdapters: string[];
  detections: AdapterDetectionResult[];
  merged: AdapterDetectionResult;
  usedFallback: boolean;
}

export class AdapterRegistry {
  private readonly adapters: IAdapter[] = [];
  private readonly fallbackAdapter: IAdapter;

  constructor(
    adapters: IAdapter[] = [],
    fallbackAdapter: IAdapter = new GenericTextAdapter()
  ) {
    this.fallbackAdapter = fallbackAdapter;

    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter: IAdapter): this {
    const existingIndex = this.adapters.findIndex(
      (existing) => existing.name === adapter.name
    );

    if (existingIndex >= 0) {
      this.adapters[existingIndex] = adapter;
    } else {
      this.adapters.push(adapter);
    }

    return this;
  }

  list(): IAdapter[] {
    return [...this.adapters];
  }

  async analyze(
    contextInput: AdapterContext | AdapterContextInput
  ): Promise<AdapterRegistryResult> {
    const context =
      contextInput instanceof AdapterContext
        ? contextInput
        : new AdapterContext(contextInput);

    const matchedAdapters: IAdapter[] = [];

    for (const adapter of this.adapters) {
      if (await adapter.canHandle(context)) {
        matchedAdapters.push(adapter);
      }
    }

    const usedFallback = matchedAdapters.length === 0;
    const adaptersToRun = usedFallback ? [this.fallbackAdapter] : matchedAdapters;
    const detections = sortByConfidence(
      await Promise.all(
        adaptersToRun.map(async (adapter) => {
          const detection = await adapter.detect(context);
          const analysis = await adapter.analyze(context);
          return mergeResultsForAdapter(adapter, [detection, analysis]);
        })
      )
    );

    return {
      context,
      matchedAdapters: adaptersToRun.map((adapter) => adapter.name),
      detections,
      merged: mergeAdapterDetectionResults(detections),
      usedFallback
    };
  }
}

function mergeResultsForAdapter(
  adapter: IAdapter,
  results: AdapterDetectionResult[]
): AdapterDetectionResult {
  const merged = mergeAdapterDetectionResults(results);

  return new AdapterDetectionResult({
    adapterName: adapter.name,
    adapterVersion: adapter.version,
    capabilities: merged.capabilities,
    score: merged.score,
    languages: merged.languages,
    frameworks: merged.frameworks,
    packageManagers: merged.packageManagers,
    commands: merged.commands,
    sourceFolders: merged.sourceFolders,
    testFolders: merged.testFolders,
    configFiles: merged.configFiles,
    entryPoints: merged.entryPoints,
    featurePatterns: merged.featurePatterns,
    architecturalPatterns: merged.architecturalPatterns,
    diagnostics: merged.diagnostics
  });
}

function sortByConfidence(results: AdapterDetectionResult[]): AdapterDetectionResult[] {
  return [...results].sort((left, right) => right.score.value - left.score.value);
}
