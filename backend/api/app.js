import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "../routes/index.js";
import { errorHandler, notFoundHandler } from "../middleware/errorHandler.js";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: "*",
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
