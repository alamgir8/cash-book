import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Collection scheme — e.g. "নতুন ৫০০ টাকা (৪)" with a fixed rate per member.
 * Families enroll via SchemeMember; payments are normal Transactions with scheme set.
 */
const collectionSchemeSchema = new Schema(
  {
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    rate_per_member: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    default_account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
    },
    default_category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archived_at: {
      type: Date,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    collection: "collection_schemes",
  },
);

collectionSchemeSchema.index({ admin: 1, archived: 1, name: 1 });
collectionSchemeSchema.index({ organization: 1, archived: 1, name: 1 });

export const CollectionScheme = mongoose.model(
  "CollectionScheme",
  collectionSchemeSchema,
);
