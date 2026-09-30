export interface Tenant {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  tenantId: string;
  role: "admin" | "member";
}

export interface Project {
  id: string;
  tenantId: string;
  name: string;
}

export const tenants: Tenant[] = [
  { id: "tenant-acme", name: "Acme Co" },
  { id: "tenant-globex", name: "Globex Corporation" },
];

export const users: User[] = [
  {
    id: "user-ada",
    email: "ada@acme.test",
    name: "Ada Lovelace",
    password: "demo-ada",
    tenantId: "tenant-acme",
    role: "admin",
  },
  {
    id: "user-grace",
    email: "grace@globex.test",
    name: "Grace Hopper",
    password: "demo-grace",
    tenantId: "tenant-globex",
    role: "admin",
  },
];

export const projects: Project[] = [
  { id: "project-1", tenantId: "tenant-acme", name: "Website relaunch" },
  { id: "project-2", tenantId: "tenant-globex", name: "Warehouse audit" },
];
