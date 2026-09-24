import {
  configPage,
  configVar,
  connectionConfigVar,
} from "@prismatic-io/spectral";

export const configPages = {
  Salesforce: configPage({
    tagline: "Configure Salesforce synchronization",
    elements: {
      "Salesforce Connection": connectionConfigVar({
        stableKey: "salesforce-sync-connection",
        dataType: "connection",
        connection: {
          component: "salesforce",
          key: "oauth2",
          values: {},
        },
      }),
      "Salesforce Record Type": configVar({
        stableKey: "salesforce-sync-record-type",
        dataType: "string",
        description:
          "Enter the Salesforce object API name to synchronize, such as Account or Opportunity.",
      }),
      "Destination URL": configVar({
        stableKey: "salesforce-sync-destination-url",
        dataType: "string",
        defaultValue: "https://api.example.test/salesforce/events",
      }),
    },
  }),
};
