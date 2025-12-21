import { Organization, BUSINESS_TYPE_OPTIONS } from "../models/Organization.js";
import {
  OrganizationMember,
  MEMBER_ROLE_OPTIONS,
  ROLE_PERMISSION_DEFAULTS,
} from "../models/OrganizationMember.js";
import { Admin } from "../models/Admin.js";
import { Category } from "../models/Category.js";
import { DEFAULT_CATEGORIES } from "../constants/defaultCategories.js";

/**
 * Create a new organization
 */
export const createOrganization = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      name,
      business_type,
      description,
      phone,
      email,
      website,
      address,
      contact,
      settings,
    } = req.body;

    if (!name || name.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Organization name is required (min 2 characters)" });
    }

    // Handle contact fields (can be direct or nested in contact object)
    const phoneValue = contact?.phone || phone;
    const emailValue = contact?.email || email;
    const websiteValue = contact?.website || website;

    // Create organization
    const organization = await Organization.create({
      name: name.trim(),
      business_type: business_type || "general",
      description,
      phone: phoneValue,
      email: emailValue,
      website: websiteValue,
      address,
      settings,
      owner: userId,
      member_count: 1,
    });

    // Add owner as member
    await OrganizationMember.create({
      organization: organization._id,
      user: userId,
      role: "owner",
      permissions: ROLE_PERMISSION_DEFAULTS.owner,
      joined_at: new Date(),
      status: "active",
    });

    // Create default categories for the organization
    if (DEFAULT_CATEGORIES.length > 0) {
      try {
        await Category.insertMany(
          DEFAULT_CATEGORIES.map((category) => ({
            organization: organization._id,
            admin: userId,
            ...category,
          })),
          { ordered: false }
        );
      } catch (categoryError) {
        if (categoryError.code !== 11000) {
          console.warn(
            "Failed to seed default categories for organization",
            categoryError
          );
        }
      }
    }

    res.status(201).json({
      message: "Organization created successfully",
      organization,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "An organization with this name already exists" });
    }
    next(error);
  }
};

/**
 * Get all organizations for the current user
 */
export const getMyOrganizations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const memberships = await OrganizationMember.find({
      user: userId,
      status: { $in: ["active", "invited"] },
    })
      .populate({
        path: "organization",
        match: { status: { $ne: "archived" } },
      })
      .sort({ updatedAt: -1 });

    const organizations = memberships
      .filter((m) => m.organization)
      .map((m) => ({
        ...m.organization.toObject(),
        role: m.role,
        permissions: m.permissions,
        member_status: m.status,
        joined_at: m.joined_at,
      }));

    res.json({ organizations });
  } catch (error) {
    next(error);
  }
};

/**
 * Get organization by ID
 */
export const getOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.id;

    const membership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "active",
    });

    if (!membership) {
      return res
        .status(403)
        .json({ message: "Access denied to this organization" });
    }

    const organization = await Organization.findById(organizationId).populate(
      "owner",
      "name email"
    );

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Get members list
    const members = await OrganizationMember.find({
      organization: organizationId,
      status: { $ne: "removed" },
    })
      .populate("user", "name email phone")
      .populate("invited_by", "name email")
      .sort({ role: 1, joined_at: 1 });

    res.json({
      organization: {
        ...organization.toObject(),
        role: membership.role,
        permissions: membership.permissions,
      },
      members,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update organization
 */
export const updateOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Check permission
    const membership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "active",
    });

    if (!membership || !membership.hasPermission("manage_organization")) {
      return res.status(403).json({
        message: "You don't have permission to update this organization",
      });
    }

    // Fields that can be updated
    const allowedUpdates = [
      "name",
      "business_type",
      "description",
      "logo_url",
      "phone",
      "email",
      "website",
      "address",
      "settings",
      "contact",
    ];

    const updateData = {};
    for (const field of allowedUpdates) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    // Handle contact object if provided
    if (updates.contact) {
      if (updates.contact.phone !== undefined)
        updateData.phone = updates.contact.phone;
      if (updates.contact.email !== undefined)
        updateData.email = updates.contact.email;
      if (updates.contact.website !== undefined)
        updateData.website = updates.contact.website;
      delete updateData.contact;
    }

    const organization = await Organization.findByIdAndUpdate(
      organizationId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    res.json({
      message: "Organization updated successfully",
      organization,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get organization members
 */
export const getMembers = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.id;

    // Verify user is a member
    const membership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "active",
    });

    if (!membership) {
      return res.status(403).json({ message: "Access denied" });
    }

    const members = await OrganizationMember.find({
      organization: organizationId,
      status: { $ne: "removed" },
    })
      .populate("user", "name email phone")
      .populate("invited_by", "name email")
      .sort({ role: 1, joined_at: 1 });

    res.json({ members });
  } catch (error) {
    next(error);
  }
};

/**
 * Invite a member to organization
 */
export const inviteMember = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.id;
    const { email, phone, role = "cashier", display_name } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Email or phone is required" });
    }

    // Check permission
    const membership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "active",
    });

    if (!membership || !membership.hasPermission("manage_members")) {
      return res
        .status(403)
        .json({ message: "You don't have permission to invite members" });
    }

    // Cannot invite with higher role than own
    const roleHierarchy = { owner: 0, manager: 1, cashier: 2, viewer: 3 };
    if (roleHierarchy[role] < roleHierarchy[membership.role]) {
      return res
        .status(403)
        .json({ message: "Cannot invite members with higher role than yours" });
    }

    // Find user by email or phone
    const query = [];
    if (email) query.push({ email: email.toLowerCase() });
    if (phone) query.push({ phone });

    const invitedUser = await Admin.findOne({ $or: query });

    // If user doesn't exist, they need to sign up first
    if (!invitedUser) {
      return res.status(404).json({
        message: "User not found. They need to create an account first.",
        code: "USER_NOT_FOUND",
      });
    }

    // Check if already a member
    const existingMember = await OrganizationMember.findOne({
      organization: organizationId,
      user: invitedUser._id,
    });

    if (existingMember) {
      if (existingMember.status === "removed") {
        // Reactivate
        existingMember.status = "invited";
        existingMember.role = role;
        existingMember.permissions = ROLE_PERMISSION_DEFAULTS[role];
        existingMember.invited_by = userId;
        existingMember.invited_at = new Date();
        existingMember.display_name = display_name;
        await existingMember.save();

        return res.json({
          message: "Member re-invited successfully",
          member: existingMember,
        });
      }
      return res
        .status(409)
        .json({ message: "User is already a member of this organization" });
    }

    // Create invitation
    const newMember = await OrganizationMember.create({
      organization: organizationId,
      user: invitedUser._id,
      role,
      permissions: ROLE_PERMISSION_DEFAULTS[role],
      invited_by: userId,
      invited_at: new Date(),
      status: "invited",
      display_name,
    });

    // Update member count
    await Organization.findByIdAndUpdate(organizationId, {
      $inc: { member_count: 1 },
    });

    // Populate user info
    await newMember.populate("user", "name email phone");

    res.status(201).json({
      message: "Member invited successfully",
      member: newMember,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept organization invitation
 */
export const acceptInvitation = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.id;

    const membership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "invited",
    });

    if (!membership) {
      return res.status(404).json({ message: "No pending invitation found" });
    }

    membership.status = "active";
    membership.joined_at = new Date();
    await membership.save();

    const organization = await Organization.findById(organizationId);

    res.json({
      message: "Invitation accepted",
      organization: {
        ...organization.toObject(),
        role: membership.role,
        permissions: membership.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update member role
 */
export const updateMemberRole = async (req, res, next) => {
  try {
    const { organizationId, memberId } = req.params;
    const userId = req.user.id;
    const { role, permissions } = req.body;

    // Check permission
    const myMembership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "active",
    });

    if (!myMembership || !myMembership.hasPermission("manage_members")) {
      return res
        .status(403)
        .json({ message: "You don't have permission to manage members" });
    }

    const targetMember = await OrganizationMember.findById(memberId);

    if (
      !targetMember ||
      targetMember.organization.toString() !== organizationId
    ) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Cannot modify owner unless you are owner
    if (targetMember.role === "owner" && myMembership.role !== "owner") {
      return res.status(403).json({ message: "Cannot modify owner role" });
    }

    // Cannot set role higher than own
    const roleHierarchy = { owner: 0, manager: 1, cashier: 2, viewer: 3 };
    if (role && roleHierarchy[role] < roleHierarchy[myMembership.role]) {
      return res
        .status(403)
        .json({ message: "Cannot assign role higher than yours" });
    }

    if (role) {
      targetMember.role = role;
      targetMember.permissions = permissions || ROLE_PERMISSION_DEFAULTS[role];
    } else if (permissions) {
      targetMember.permissions = {
        ...targetMember.permissions,
        ...permissions,
      };
    }

    await targetMember.save();

    res.json({
      message: "Member updated successfully",
      member: targetMember,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove member from organization
 */
export const removeMember = async (req, res, next) => {
  try {
    const { organizationId, memberId } = req.params;
    const userId = req.user.id;

    // Check permission
    const myMembership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "active",
    });

    if (!myMembership || !myMembership.hasPermission("manage_members")) {
      return res
        .status(403)
        .json({ message: "You don't have permission to remove members" });
    }

    const targetMember = await OrganizationMember.findById(memberId);

    if (
      !targetMember ||
      targetMember.organization.toString() !== organizationId
    ) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Cannot remove owner
    if (targetMember.role === "owner") {
      return res
        .status(403)
        .json({ message: "Cannot remove organization owner" });
    }

    // Cannot remove self (use leave instead)
    if (targetMember.user.toString() === userId) {
      return res
        .status(400)
        .json({ message: "Use leave endpoint to remove yourself" });
    }

    targetMember.status = "removed";
    await targetMember.save();

    // Update member count
    await Organization.findByIdAndUpdate(organizationId, {
      $inc: { member_count: -1 },
    });

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Leave organization
 */
export const leaveOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.id;

    const membership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "active",
    });

    if (!membership) {
      return res
        .status(404)
        .json({ message: "You are not a member of this organization" });
    }

    // Owner cannot leave
    if (membership.role === "owner") {
      return res.status(400).json({
        message:
          "Owner cannot leave. Transfer ownership first or delete the organization.",
      });
    }

    membership.status = "removed";
    await membership.save();

    // Update member count
    await Organization.findByIdAndUpdate(organizationId, {
      $inc: { member_count: -1 },
    });

    res.json({ message: "Left organization successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete organization (owner only)
 */
export const deleteOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.id;

    // Check if user is owner
    const membership = await OrganizationMember.findOne({
      organization: organizationId,
      user: userId,
      status: "active",
    });

    if (!membership || membership.role !== "owner") {
      return res.status(403).json({
        message: "Only the owner can delete the organization",
      });
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Soft delete by archiving
    organization.status = "archived";
    await organization.save();

    // Update all memberships
    await OrganizationMember.updateMany(
      { organization: organizationId },
      { $set: { status: "removed" } }
    );

    res.json({ message: "Organization deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available options
 */
export const getOptions = async (req, res) => {
  res.json({
    business_types: BUSINESS_TYPE_OPTIONS,
    member_roles: MEMBER_ROLE_OPTIONS,
    role_permissions: ROLE_PERMISSION_DEFAULTS,
  });
};
