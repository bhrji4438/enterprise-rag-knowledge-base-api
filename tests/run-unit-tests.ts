import { testCachedResponsesSkipProviders, testFallbackToSecondaryProvider } from "./unit/llm-facade.spec.js";

const tests: Array<[string, () => Promise<void>]> = [
  ["LlmFacade returns cached responses without calling providers", testCachedResponsesSkipProviders],
  ["LlmFacade falls back to the secondary provider", testFallbackToSecondaryProvider]
];

let failed = 0;

for (const [name, test] of tests) {
  try {
    await test();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}
