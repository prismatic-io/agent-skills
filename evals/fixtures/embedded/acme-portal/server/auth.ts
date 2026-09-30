import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { type Tenant, type User, tenants, users } from "./data.ts";

export interface SessionUser {
  user: User;
  tenant: Tenant;
}

declare module "express-serve-static-core" {
  interface Request {
    session?: SessionUser;
  }
}

const sessions = new Map<string, string>();

const readCookie = (request: Request, name: string) =>
  request.headers.cookie
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];

export const signIn = (response: Response, user: User) => {
  const sessionId = randomUUID();
  sessions.set(sessionId, user.id);
  response.cookie("sid", sessionId, { httpOnly: true, sameSite: "lax" });
};

export const signOut = (request: Request, response: Response) => {
  const sessionId = readCookie(request, "sid");
  if (sessionId) sessions.delete(sessionId);
  response.clearCookie("sid");
};

export const findUserByCredentials = (email: string, password: string) =>
  users.find((user) => user.email === email && user.password === password);

export const requireUser = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const sessionId = readCookie(request, "sid");
  const user = users.find(
    ({ id }) => sessionId !== undefined && id === sessions.get(sessionId),
  );
  const tenant = tenants.find(({ id }) => id === user?.tenantId);
  if (!user || !tenant) {
    response.status(401).json({ error: "Sign in required" });
    return;
  }
  request.session = { user, tenant };
  next();
};
