import mongoose from "mongoose";

const isProduction = process.env.NODE_ENV === "production";

export const connectDatabase = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri, {
      // In production, build indexes via migration scripts, not at startup
      autoIndex: !isProduction,
      // Connection pool tuning for high-concurrency
      maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 50,
      minPoolSize: 5,
      // Timeout settings to fail fast rather than hang
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      connectTimeoutMS: 10_000,
      // Heartbeat interval for replica set monitoring
      heartbeatFrequencyMS: 10_000,
    });
    console.log("✅ MongoDB connected");

    // Connection event handlers for observability
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB reconnected");
    });
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};
