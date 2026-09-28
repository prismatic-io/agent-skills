import { configPage, connectionConfigVar } from "@prismatic-io/spectral";

export const configPages = {
  Archive: configPage({
    elements: {
      "Ticket Archive": connectionConfigVar({
        stableKey: "ticket-archive",
        dataType: "connection",
        inputs: {
          baseUrl: { label: "Base URL", type: "string", required: true },
          token: { label: "Bearer Token", type: "password", required: true },
        },
      }),
    },
  }),
};
