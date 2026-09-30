import { Router } from "express";
import { findUserByCredentials, requireUser, signIn, signOut } from "../auth.ts";
import { projects } from "../data.ts";

export const apiRouter = Router();

apiRouter.post("/login", (request, response) => {
  const { email, password } = request.body ?? {};
  const user = findUserByCredentials(String(email), String(password));
  if (!user) {
    response.status(401).json({ error: "Invalid email or password" });
    return;
  }
  signIn(response, user);
  response.status(204).end();
});

apiRouter.post("/logout", (request, response) => {
  signOut(request, response);
  response.status(204).end();
});

apiRouter.get("/me", requireUser, (request, response) => {
  const { user, tenant } = request.session!;
  response.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name },
  });
});

apiRouter.get("/projects", requireUser, (request, response) => {
  const { tenant } = request.session!;
  response.json(projects.filter(({ tenantId }) => tenantId === tenant.id));
});
