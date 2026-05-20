import { AngularAdapter } from "./angular-adapter.js";
import { JavaAdapter } from "./java-adapter.js";
import { JavaScriptTypeScriptAdapter } from "./javascript-typescript-adapter.js";
import { PythonAdapter } from "./python-adapter.js";
import { ReactAdapter } from "./react-adapter.js";
import { AdapterRegistry } from "./registry.js";
import type { IAdapter } from "./types.js";

export function createDefaultAdapters(): IAdapter[] {
  return [
    new JavaScriptTypeScriptAdapter(),
    new ReactAdapter(),
    new AngularAdapter(),
    new PythonAdapter(),
    new JavaAdapter()
  ];
}

export function createDefaultAdapterRegistry(): AdapterRegistry {
  return new AdapterRegistry(createDefaultAdapters());
}
