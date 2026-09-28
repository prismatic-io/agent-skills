# Finance CSV import

Prerequisite: Python 3 standard library. Run
`python3 import_settlements.py settlements.csv accepted.jsonl rejects.jsonl`.
Files arrive on a managed SFTP directory each business day. An existing wrapper
downloads a complete file under a temporary name and renames it before invoking
this script. An ERP loader consumes accepted.jsonl; finance reviews rejects.jsonl.
The replacement boundary is the conversion, not the unspecified SFTP or ERP
accounts. A Prismatic callable flow accepting complete file contents and returning
both outputs is acceptable for the wrapper team to connect later.

Inputs are UTF-8 with an optional BOM and a header row. Standard CSV quoting
allows commas and line breaks within memo. Identifiers are strings, including
leading zeroes. USD and EUR have two decimal places; refunds are negative and
zero amounts are valid. amountMinor is a decimal integer STRING: downstream must
not round it through JavaScript Number. Some consolidated historical balances
are above the exact-integer limit of that representation. Inputs contain at most
24 significant decimal digits, within the legacy Decimal precision.

Individual invalid rows go to the reject output without blocking later rows.
endingLine is the physical line at which that CSV record ended, including header
and embedded newlines. Missing required headers abort the conversion. Output
files are replaced on each run; the wrapper archives the original and both outputs
together, under the input filename. Files are never directly posted to the ERP
by this script. No live SFTP/ERP credentials are available.
