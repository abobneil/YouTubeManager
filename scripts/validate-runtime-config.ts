import { validateRuntimeConfig } from "../src/lib/config";

const issues = validateRuntimeConfig();

if (issues.length > 0) {
  throw new Error(`Invalid runtime configuration:\n${issues.join("\n")}`);
}
