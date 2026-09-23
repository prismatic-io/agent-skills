import { action, component, input, util } from "@prismatic-io/spectral";
import { apiConnection, connectionInput, request } from "./api";

const createTask = action({
  display: { label: "Create Task", description: "Create a task in a project" },
  inputs: {
    connection: connectionInput,
    projectId: input({
      label: "Project ID",
      type: "string",
      required: true,
      clean: util.types.toString,
    }),
    title: input({
      label: "Title",
      type: "string",
      required: true,
      clean: util.types.toString,
    }),
  },
  perform: async (_context, { connection, projectId, title }) => ({
    data: await request(
      connection,
      `/projects/${encodeURIComponent(projectId)}/tasks`,
      "POST",
      { title },
    ),
  }),
});
export default component({
  key: "eval-tasks-baseline",
  public: false,
  display: {
    iconPath: "icon.png",
    label: "Partner Tasks",
    description: "Create project tasks",
  },
  connections: [apiConnection],
  actions: { createTask },
});
