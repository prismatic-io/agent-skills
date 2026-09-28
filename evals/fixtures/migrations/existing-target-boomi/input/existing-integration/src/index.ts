import { configPage, configVar, integration } from "@prismatic-io/spectral";
import { receiptFlow } from "./receipt";

export const configPages = {
  Warehouse: configPage({
    elements: {
      "Receipt Prefix": configVar({
        stableKey: "warehouse-receipt-prefix",
        dataType: "string",
        defaultValue: "RCPT",
      }),
    },
  }),
};

export default integration({
  name: "Warehouse Integration",
  description: "Warehouse callbacks and order intake",
  flows: [receiptFlow],
  configPages,
});
