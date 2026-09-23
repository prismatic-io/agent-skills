import { type Connection, connection, input } from "@prismatic-io/spectral";
export const apiConnection = connection({
  key: "apiKey",
  display: {
    label: "Partner API",
    description: "Partner endpoint and API key",
  },
  inputs: {
    baseUrl: input({ label: "API URL", type: "string", required: true }),
    apiKey: input({ label: "API Key", type: "password", required: true }),
  },
});
export const connectionInput = input({
  label: "Connection",
  type: "connection",
  required: true,
});
export const request = async (
  connection: Connection,
  path: string,
  method = "GET",
  body?: unknown,
) => {
  const response = await fetch(
    `${String(connection.fields.baseUrl).replace(/\/$/, "")}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${connection.fields.apiKey}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  if (!response.ok)
    throw new Error(`Partner API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
};
