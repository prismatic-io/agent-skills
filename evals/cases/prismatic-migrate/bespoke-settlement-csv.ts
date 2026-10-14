import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/bespoke-settlement-csv/input",
  prompt: suite.prompt(
    "Move this finance CSV conversion into a callable Prismatic integration. Our wrapper team will connect file transfer and the ERP loader later. Finance needs both the converted records and the rejects so we can reconcile each file; silently changing which rows are accepted would be a problem. Compare the replacement with the existing script using the supplied file and representative variations, and explain how the wrapper will receive both outputs.",
  ),
  persona:
    "You own the finance import and reconciliation process. The supplied script and legacy/HANDOVER.md describe the process. If asked about the integration boundary, the wrapper team will provide complete file contents and accepts a callable conversion returning both outputs; SFTP and ERP work is outside this request. If asked how rejects are used, finance reviews them and the wrapper archives the input with both outputs, so losing rejected records is unacceptable. If asked to simplify parsing, currency rules, accepted number forms, or rounding, you have no approved business change: the existing conversion remains the reference. Do not pretend you know undocumented upstream limits or approve narrower input handling because the sample happens to be small. No live accounts are available.",
  assertions: [
    {
      type: "rubric",
      id: "csv-and-money",
      criteria:
        "Registered callable conversion handles real CSV quoting, newlines and optional BOM, preserves identifiers and memo values, and produces exact integer-string minor units without rounding via JavaScript Number. Negative and zero values are accepted; fractional cents are rejected. Preserve accepted-versus-rejected classification for source-supported finite decimal lexical forms, not just the sample numeral format. Narrowing accepted forms requires an actual business override; disclosure by the agent alone does not establish equivalent behavior. Both outputs are accessible to the actual caller through a configured synchronous invocation or an explicit documented result-retrieval contract; onExecution data alone does not establish an HTTP response. Do not invent SFTP/ERP calls. Accept USD/EUR with at most 24 significant decimal digits. +1.25 and padded 1.25 yield 125, 1e2 yields 10000, and .50 yields 50. Accepted JSONL fields are settlementId, merchantId, amountMinor:string, currency and memo, remaining exact above JavaScript safe integer.",
    },
    {
      type: "rubric",
      id: "reject-continuation",
      criteria:
        "Invalid records are preserved in the reject output with their original fields and correct physical ending line, while subsequent valid rows are processed. Missing required headers fail the conversion rather than returning successful empty output. Error wording may differ if reason remains accurate; do not require literal Python exception text. Required headers are settlement_id, merchant_id, amount, currency and memo. Nonfinite amounts, unsupported currencies and invalid identifiers reject the row. Reject JSONL carries endingLine, original row and error.",
    },
  ],
});
