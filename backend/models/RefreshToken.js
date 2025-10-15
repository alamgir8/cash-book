import mongoose from "mongoose";

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    token_hash: {
      type: String,
      required: true,
      unique: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
    user_agent: {
      type: String,
      trim: true,
    },
    created_ip: {
      type: String,
      trim: true,
    },
    revoked_at: {
      type: Date,
    },
    replaced_by_token: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

refreshTokenSchema.index(
  { admin: 1, token_hash: 1 },
  { unique: true }
);

export const RefreshToken = mongoose.model(
  "RefreshToken",
  refreshTokenSchema,
  "refresh_tokens"
);
