import csv
import json
import sys
from decimal import Decimal, InvalidOperation


def convert(source, accepted, rejected):
    reader = csv.DictReader(source)
    required = {"settlement_id", "merchant_id", "amount", "currency", "memo"}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError("Missing required CSV headers")
    for row in reader:
        try:
            if None in row or not row["settlement_id"] or not row["merchant_id"]:
                raise ValueError("Invalid columns or missing identifier")
            if row["currency"] not in {"USD", "EUR"}:
                raise ValueError("Unsupported currency")
            amount = Decimal(row["amount"])
            minor = amount * 100
            if not minor.is_finite() or minor != minor.to_integral_value():
                raise ValueError("Amount must have whole cents")
            result = {
                "settlementId": row["settlement_id"],
                "merchantId": row["merchant_id"],
                "amountMinor": str(int(minor)),
                "currency": row["currency"],
                "memo": row["memo"],
            }
        except (ValueError, InvalidOperation, TypeError) as error:
            rejected.write(json.dumps({"endingLine": reader.line_num, "row": row, "error": str(error)}) + "\n")
            continue
        accepted.write(json.dumps(result) + "\n")


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8-sig", newline="") as source, \
         open(sys.argv[2], "w", encoding="utf-8") as accepted, \
         open(sys.argv[3], "w", encoding="utf-8") as rejected:
        convert(source, accepted, rejected)
