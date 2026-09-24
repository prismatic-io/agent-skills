import { flow } from "@prismatic-io/spectral";

export const syncSalesforceRecords = flow({
  name: "Sync Salesforce Records",
  stableKey: "7af233d7-7622-45cb-9278-d222ba89f31d",
  description:
    "Synchronizes records from the deployer-selected Salesforce object.",
  onTrigger: async (_context, payload) => Promise.resolve({ payload }),
  onExecution: async (_context, params) => {
    return Promise.resolve({
      data: {
        trigger: params.onTrigger.results,
      },
    });
  },
});
