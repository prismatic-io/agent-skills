import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
// Evals pins the TypeScript compiler API for AST inspection; repository tsc stays on TS 7.
// No Paragon runtime is mocked.
const ts = require("typescript-compiler-api");
const source = new URL(
  "./input/legacy/paragraph/src/integrations/slack/workflows/3AgenticActionTutorialSendSlackMessage.ts",
  import.meta.url,
);
const tree = ts.createSourceFile(
  source.pathname,
  await readFile(source, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const nodes = [];
const visit = (n) => {
  nodes.push(n);
  ts.forEachChild(n, visit);
};
visit(tree);
const variable = (name) => {
  return nodes.find(
    (n) => ts.isVariableDeclaration(n) && n.name.getText(tree) === name,
  ).initializer;
};
const prop = (obj, key) => {
  const p = obj.properties.find((p) => p.name?.getText(tree) === key);
  assert.ok(p, `missing ${key}`);
  return p.initializer;
};
const literal = (n) => {
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
    return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  throw Error(`not literal: ${n.getText(tree)}`);
};
const trigger = variable("triggerStep").arguments[0],
  action = variable("actionStep"),
  response = variable("responseStep").arguments[0];
test("required string body declaration is retained", () => {
  assert.equal(literal(prop(trigger, "allowArbitraryPayload")), false);
  const rule = prop(trigger, "bodyValidations").elements[0];
  assert.equal(literal(prop(rule, "key")), "message");
  assert.equal(literal(prop(rule, "dataType")), "STRING");
  assert.equal(literal(prop(rule, "required")), true);
});
test("send action preserves source expression and connected-user intent", () => {
  assert.equal(
    action.expression.getText(tree),
    "integration.actions.sendMessage",
  );
  const args = action.arguments[0];
  assert.equal(literal(prop(args, "authenticatedUser")), true);
  assert.equal(literal(prop(args, "channel")), "parato-testing-ground");
  const msg = prop(args, "message");
  assert.ok(ts.isTemplateExpression(msg));
  assert.equal(msg.head.text, "");
  assert.equal(msg.templateSpans.length, 1);
  assert.equal(
    msg.templateSpans[0].expression.getText(tree),
    "triggerStep.output.request.body.message",
  );
  assert.equal(msg.templateSpans[0].literal.text, "");
});
test("consequential failure options disable retry and continuation", () => {
  const options = action.arguments[1];
  assert.equal(literal(prop(options, "autoRetry")), false);
  assert.equal(literal(prop(options, "continueWorkflowOnError")), false);
});
test("caller result selects action ok rather than a constant", () => {
  assert.equal(literal(prop(response, "statusCode")), 200);
  assert.equal(literal(prop(response, "responseType")), "JSON");
  assert.equal(
    prop(prop(response, "body"), "status").getText(tree),
    "actionStep.output.result.ok",
  );
});
test("registered graph sequences send before response", () => {
  assert.ok(
    nodes.some(
      (n) =>
        ts.isCallExpression(n) &&
        n.getText(tree) ===
          "triggerStep.nextStep(actionStep).nextStep(responseStep)",
    ),
  );
  const reg = nodes.find(
    (n) =>
      ts.isCallExpression(n) && n.expression.getText(tree) === "this.register",
  );
  assert.deepEqual(
    reg.arguments[0].properties.map((p) => p.name.getText(tree)),
    ["triggerStep", "actionStep", "responseStep"],
  );
  const enabled = nodes.find(
    (n) =>
      ts.isPropertyDeclaration(n) && n.name.getText(tree) === "defaultEnabled",
  );
  assert.equal(literal(enabled.initializer), false);
});
test("packet does not pretend to provide generated Slack runtime", async () => {
  const pkg = JSON.parse(
    await readFile(
      new URL("./input/legacy/paragraph/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(pkg.dependencies["@useparagon/core"], "1.0.9");
  assert.equal(pkg.dependencies["@useparagon/integrations"], undefined);
  assert.equal(
    existsSync(
      new URL(
        "./input/legacy/paragraph/src/integrations/slack/workflows/1ParagonTutorialInitialChannelSync.ts",
        import.meta.url,
      ),
    ),
    false,
  );
});
