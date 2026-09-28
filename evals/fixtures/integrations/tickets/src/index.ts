import { integration } from "@prismatic-io/spectral";
import flows from "./flows";
import { configPages } from "./configPages";
import { componentRegistry } from "./componentRegistry";
import documentation from "../documentation.md";

export { configPages } from "./configPages";
export { componentRegistry } from "./componentRegistry";

export default integration({
  name: "Ticket Mirror",
  description: "Mirror ticket webhooks to a customer archive",
  iconPath: "icon.png",
  documentation,
  flows,
  configPages,
  componentRegistry,
});
