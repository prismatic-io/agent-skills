import type { configPages } from "./index";

type Pages = typeof configPages;

declare module "@prismatic-io/spectral" {
  interface IntegrationDefinitionConfigPages extends Pages {}
}
