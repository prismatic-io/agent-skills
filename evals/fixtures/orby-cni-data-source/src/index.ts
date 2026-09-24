import { integration } from "@prismatic-io/spectral";
import { configPages } from "./configPages";
import { syncSalesforceRecords } from "./flows";

export default integration({
  name: "Salesforce Sync",
  description: "Synchronize configurable Salesforce records.",
  iconPath: "icon.png",
  flows: [syncSalesforceRecords],
  configPages,
});
