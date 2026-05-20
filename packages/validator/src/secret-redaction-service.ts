import type { RedactionResult } from "./models.js";

interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...args: string[]) => string);
}

export class SecretRedactionService {
  redact(text: string): RedactionResult {
    const redactionsApplied = new Set<string>();
    let redacted = text;

    for (const rule of redactionRules) {
      redacted = redacted.replace(rule.pattern, (...args: string[]) => {
        redactionsApplied.add(rule.name);
        return typeof rule.replacement === "function"
          ? rule.replacement(args[0] ?? "", ...args.slice(1))
          : rule.replacement;
      });
    }

    return {
      text: redacted,
      redactionsApplied: [...redactionsApplied]
    };
  }
}

const redactionRules: RedactionRule[] = [
  {
    name: "env-secret",
    pattern:
      /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY)[A-Z0-9_]*)=([^\s]+)/gi,
    replacement: (_match: string, key: string) => `${key}=[REDACTED]`
  },
  {
    name: "bearer-token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: "Bearer [REDACTED]"
  },
  {
    name: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]+/g,
    replacement: "[REDACTED_GITHUB_TOKEN]"
  }
];
