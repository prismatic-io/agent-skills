import { defineCase as baseCase } from "../_suite.ts";

export const defineCase = baseCase.extend({
  defaults: { meta: { tags: ["train"] } },
  assertionDefaults: { rubric: { evidence: { view: "execution" } } },
});
