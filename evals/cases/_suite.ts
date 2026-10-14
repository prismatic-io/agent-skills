import { defineEvalCase } from "@prismatic-io/lux";

export const defineCase = defineEvalCase.extend({
  defaults: { assertions: [{ id: "completed", type: "run-succeeded" }] },
  assertionDefaults: { rubric: { evidence: { view: "source" } } },
});
