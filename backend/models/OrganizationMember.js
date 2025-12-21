import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * OrganizationMember links users to organizations with specific roles and permissions
 */

const MEMBER_ROLES = ["owner", "manager", "cashier", "viewer"];

const ROLE_PERMISSIONS = {
  owner: {
    // Full access
    manage_organization: true,
    manage_members: true,
    manage_accounts: true,
    manage_categories: true,
    manage_customers: true,
    manage_suppliers: true,
    create_transactions: true,
    edit_transactions: true,
    delete_transactions: true,
    view_transactions: true,
    create_invoices: true,
    edit_invoices: true,
    delete_invoices: true,
    view_invoices: true,
    view_reports: true,
    export_data: true,
    backup_restore: true,
  },
  manager: {
    // Management access without org settings
    manage_organization: false,
    manage_members: true,
    manage_accounts: true,
    manage_categories: true,
    manage_customers: true,
    manage_suppliers: true,
    create_transactions: true,
    edit_transactions: true,
    delete_transactions: true,
    view_transactions: true,
    create_invoices: true,
    edit_invoices: true,
    delete_invoices: false,
    view_invoices: true,
    view_reports: true,
    export_data: true,
    backup_restore: false,
  },
  cashier: {
    // Operational access only
    manage_organization: false,
    manage_members: false,
    manage_accounts: false,
    manage_categories: false,
    manage_customers: true,
    manage_suppliers: false,
    create_transactions: true,
    edit_transactions: false,
    delete_transactions: false,
    view_transactions: true,
    create_invoices: true,
    edit_invoices: false,
    delete_invoices: false,
    view_invoices: true,
    view_reports: false,
    export_data: false,
    backup_restore: false,
  },
  viewer: {
    // Read-only access
    manage_organization: false,
    manage_members: false,
    manage_accounts: false,
    manage_categories: false,
    manage_customers: false,
    manage_suppliers: false,
    create_transactions: false,
    edit_transactions: false,
    delete_transactions: false,
    view_transactions: true,
    create_invoices: false,
    edit_invoices: false,
    delete_invoices: false,
    view_invoices: true,
    view_reports: true,
    export_data: false,
    backup_restore: false,
  },
};

const permissionsSchema = new Schema(
  {
    manage_organization: { type: Boolean, default: false },
    manage_members: { type: Boolean, default: false },
    manage_accounts: { type: Boolean, default: false },
    manage_categories: { type: Boolean, default: false },
    manage_customers: { type: Boolean, default: false },
    manage_suppliers: { type: Boolean, default: false },
    create_transactions: { type: Boolean, default: false },
    edit_transactions: { type: Boolean, default: false },
    delete_transactions: { type: Boolean, default: false },
    view_transactions: { type: Boolean, default: true },
    create_invoices: { type: Boolean, default: false },
    edit_invoices: { type: Boolean, default: false },
    delete_invoices: { type: Boolean, default: false },
    view_invoices: { type: Boolean, default: true },
    view_reports: { type: Boolean, default: false },
    export_data: { type: Boolean, default: false },
    backup_restore: { type: Boolean, default: false },
  },
  { _id: false }
);

const memberSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: false, // Allow null for pending invitations
      index: true,
    },
    role: {
      type: String,
      enum: MEMBER_ROLES,
      required: true,
      default: "cashier",
      index: true,
    },
    permissions: {
      type: permissionsSchema,
      default: function () {
        return ROLE_PERMISSIONS[this.role] || ROLE_PERMISSIONS.viewer;
      },
    },
    invited_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    invited_at: {
      type: Date,
    },
    pending_email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    pending_phone: {
      type: String,
      trim: true,
    },
    joined_at: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "invited", "suspended", "removed"],
      default: "active",
      index: true,
    },
    last_accessed_at: {
      type: Date,
    },
    // Nickname within this organization
    display_name: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique user per organization
memberSchema.index({ organization: 1, user: 1 }, { unique: true });
memberSchema.index({ user: 1, status: 1 });

// Set default permissions based on role before save
memberSchema.pre("save", function (next) {
  if (this.isModified("role") || this.isNew) {
    const defaultPerms = ROLE_PERMISSIONS[this.role];
    if (defaultPerms && (!this.permissions || this.isModified("role"))) {
      this.permissions = { ...defaultPerms };
    }
  }
  next();
});

// Instance method to check permission
memberSchema.methods.hasPermission = function (permission) {
  if (!this.permissions) return false;
  return this.permissions[permission] === true;
};

// Instance method to check if user has any of the given permissions
memberSchema.methods.hasAnyPermission = function (permissions) {
  if (!this.permissions) return false;
  return permissions.some((p) => this.permissions[p] === true);
};

// Static method to get default permissions for a role
memberSchema.statics.getDefaultPermissions = function (role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
};

export const OrganizationMember = mongoose.model(
  "OrganizationMember",
  memberSchema,
  "organization_members"
);

export const MEMBER_ROLE_OPTIONS = MEMBER_ROLES;
export const ROLE_PERMISSION_DEFAULTS = ROLE_PERMISSIONS;
