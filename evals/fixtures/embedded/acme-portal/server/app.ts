import express from "express";
import { apiRouter } from "./routes/api.ts";

export const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRouter);
  return app;
};
