import { configPage, connectionConfigVar } from "@prismatic-io/spectral";
export const configPages = {
  Destination: configPage({
    elements: {
      "Order Destination": connectionConfigVar({
        stableKey: "order-destination",
        dataType: "connection",
        inputs: {
          baseUrl: { label: "Base URL", type: "string", required: true },
          token: { label: "Bearer Token", type: "password", required: true },
        },
      }),
    },
  }),
};
