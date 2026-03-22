import "dotenv/config.js";
import http from "http";
import { createApp } from "./app.js";
import { connectDatabase } from "../config/database.js";

const port = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("Missing MONGODB_URI environment variable");
  process.exit(1);
}

// Validate critical environment variables at startup
const requiredEnvVars = ["JWT_SECRET"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn(
    "⚠️  JWT_SECRET is shorter than 32 characters — use a strong secret in production",
  );
}

const bootstrap = async () => {
  await connectDatabase(mongoUri);
  const app = createApp();
  const server = http.createServer(app);

  // Keep-alive & header timeout for production stability
  server.keepAliveTimeout = 65 * 1000; // slightly above typical LB timeout (60s)
  server.headersTimeout = 66 * 1000;

  server.listen(port, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });

  // ── Graceful shutdown ─────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(async () => {
      try {
        const mongoose = await import("mongoose");
        await mongoose.default.connection.close();
        console.log("✅ MongoDB connection closed");
      } catch (err) {
        console.error("Error closing MongoDB connection:", err);
      }
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error("⚠️  Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
