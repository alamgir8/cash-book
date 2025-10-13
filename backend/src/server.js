import "dotenv/config.js";
import http from "http";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";

const port = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("Missing MONGODB_URI environment variable");
  process.exit(1);
}

const bootstrap = async () => {
  await connectDatabase(mongoUri);
  const app = createApp();
  const server = http.createServer(app);

  server.listen(port, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
};

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
