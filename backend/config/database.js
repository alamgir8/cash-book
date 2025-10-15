import mongoose from "mongoose";

export const connectDatabase = async (mongoUri) => {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(mongoUri, {
      autoIndex: true,
    });
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};
