import { action, component, input, util } from "@prismatic-io/spectral";
import { apiConnection, connectionInput, request } from "./api";

const text = (label: string) =>
  input({ label, type: "string", required: true, clean: util.types.toString });
const getContact = action({
  display: { label: "Get Contact", description: "Retrieve a contact" },
  inputs: { connection: connectionInput, contactId: text("Contact ID") },
  perform: async (_context, { connection, contactId }) => ({
    data: await request(
      connection,
      `/contacts/${encodeURIComponent(contactId)}`,
    ),
  }),
});
const reviewContact = action({
  display: { label: "Review Contact", description: "Route a contact review" },
  allowsBranching: true,
  staticBranchNames: ["Approved", "Rejected"],
  inputs: { connection: connectionInput, contactId: text("Contact ID") },
  perform: async (_context, { connection, contactId }) => {
    const review = await request(
      connection,
      `/contacts/${encodeURIComponent(contactId)}/review`,
    );
    return review.approved
      ? {
          branch: "Approved",
          data: { contactId: review.contactId, approvedAt: review.approvedAt },
        }
      : {
          branch: "Rejected",
          data: {
            contactId: review.contactId,
            reason: review.reason,
            retryable: review.retryable,
          },
        };
  },
});
const createEmployee = action({
  display: {
    label: "Create Employee",
    description: "Create an employee from JSON",
  },
  inputs: { connection: connectionInput, employeeJson: text("Employee JSON") },
  perform: async (_context, { connection, employeeJson }) => ({
    data: await request(
      connection,
      "/employees",
      "POST",
      JSON.parse(employeeJson),
    ),
  }),
});
const createPerson = action({
  display: { label: "Create Person", description: "Create a person record" },
  inputs: {
    connection: connectionInput,
    firstName: text("First Name"),
    lastName: text("Last Name"),
    email: text("Email"),
  },
  perform: async (_context, { connection, ...person }) => ({
    data: await request(connection, "/people", "POST", person),
  }),
});
export default component({
  key: "eval-records-baseline",
  public: false,
  display: {
    iconPath: "icon.png",
    label: "Partner Records",
    description: "Contacts, employees, and people",
  },
  connections: [apiConnection],
  actions: { getContact, reviewContact, createEmployee, createPerson },
});
