import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Family enrolled in a collection scheme.
 * expected = member_count * scheme.rate_per_member (computed at read time).
 */
const schemeMemberSchema = new Schema(
  {
    scheme: {
      type: Schema.Types.ObjectId,
      ref: "CollectionScheme",
      required: true,
      index: true,
    },
    party: {
      type: Schema.Types.ObjectId,
      ref: "Party",
      required: true,
      index: true,
    },
    member_count: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    /** Village / walking order (1…N) for serial listing */
    sort_order: {
      type: Number,
      min: 1,
      max: 10000,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archived_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "scheme_members",
  },
);

// One active enrollment per party per scheme
schemeMemberSchema.index(
  { scheme: 1, party: 1 },
  {
    unique: true,
    partialFilterExpression: { archived: false },
  },
);
schemeMemberSchema.index({ scheme: 1, sort_order: 1, archived: 1 });

export const SchemeMember = mongoose.model("SchemeMember", schemeMemberSchema);
