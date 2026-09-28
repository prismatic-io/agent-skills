import { resolve } from "node:path";
import { defineMigrationCase } from "../../migration-case.ts";

export default defineMigrationCase({
  id: "bespoke-settlement-csv",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/bespoke-settlement-csv/input",
  ),
  request:
    "Move this finance CSV conversion into a callable Prismatic integration. Our wrapper team will connect file transfer and the ERP loader later. Finance needs both the converted records and the rejects so we can reconcile each file; silently changing which rows are accepted would be a problem. Compare the replacement with the existing script using the supplied file and representative variations, and explain how the wrapper will receive both outputs.",
  persona:
    "You own the finance import and reconciliation process. Answer the actual question using legacy/HANDOVER.md and the supplied script; do not volunteer numeric edge cases or a hidden test matrix. If asked about the integration boundary, the wrapper team will provide complete file contents and accepts a callable conversion returning both outputs; SFTP and ERP work is outside this request. If asked how rejects are used, finance reviews them and the wrapper archives the input with both outputs, so losing rejected records is unacceptable. If asked to simplify parsing, currency rules, accepted number forms, or rounding, you have no approved business change: the existing conversion remains the reference. Do not pretend you know undocumented upstream limits or approve narrower input handling because the sample happens to be small. No live accounts are available. Let the agent choose the target libraries and output packaging while making the callable contract clear.",
  sourceContract:
    "Python csv.DictReader with utf-8-sig supports BOM, headers, quoted commas and embedded line breaks. Required headers settlement_id, merchant_id, amount, currency, memo; missing header aborts. Identifiers remain strings. Decimal validates USD/EUR amounts have whole cents; negatives and zero valid, fractional cents/nonfinite/invalid currency/identifier rows rejected and later records continue. Accepted JSONL fields settlementId,merchantId,amountMinor STRING,currency,memo. amountMinor must remain exact above JS safe integer. Reject JSONL records endingLine physical CSV end line, original row and error. Source Decimal accepts finite leading-plus, whitespace-padded, exponent and leading-decimal-point forms when they yield whole cents; HANDOVER does not exclude these forms. Representative source-verified values: +1.25 and padded 1.25 yield 125, 1e2 yields 10000, .50 yields 50, all accepted rather than rejected. Source assumes at most 24 significant decimal digits. File conversion only, no implied transport or destination schema.",
  criteria: [
    {
      id: "csv-and-money",
      criteria:
        "Registered callable conversion handles real CSV quoting, newlines and optional BOM, preserves identifiers and memo values, and produces exact integer-string minor units without rounding via JavaScript Number. Negative and zero values are accepted; fractional cents are rejected. Preserve accepted-versus-rejected classification for source-supported finite decimal lexical forms, not just the sample numeral format. Narrowing accepted forms requires an actual business override; disclosure by the agent alone does not establish equivalent behavior. Both outputs are accessible to the actual caller through a configured synchronous invocation or an explicit documented result-retrieval contract; onExecution data alone does not establish an HTTP response. Do not invent SFTP/ERP calls.",
    },
    {
      id: "reject-continuation",
      criteria:
        "Invalid records are preserved in the reject output with their original fields and correct physical ending line, while subsequent valid rows are processed. Missing required headers fail the conversion rather than returning successful empty output. Error wording may differ if reason remains accurate; do not require literal Python exception text.",
    },
  ],
  tests:
    "Invoke the generated conversion through its registered flow or callable entry with BOM, comma/newline quoted memo, leading-zero identifiers, zero/negative amounts, source-supported finite plus/whitespace/exponent decimal forms, above-safe-integer cents, invalid fractional cents followed by valid record, missing headers and nonfinite amount. Assert complete outputs and reject physical line numbers; tests using split(',') examples alone are insufficient.",
  tags: ["bespoke", "csv", "decimal-precision", "reject-stream"],
});
