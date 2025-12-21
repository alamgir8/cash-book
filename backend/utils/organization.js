import { OrganizationMember } from "../models/OrganizationMember.js";

/**
 * Check organization access and permission
 * @param {string} userId - The user ID
 * @param {string} organizationId - The organization ID (optional)
 * @param {string} permission - The required permission (optional)
 * @returns {Object} - { hasAccess, isPersonal, membership, error }
 */
export const checkOrgAccess = async (userId, organizationId, permission) => {
  if (!organizationId) {
    return { hasAccess: true, isPersonal: true };
  }

  const membership = await OrganizationMember.findOne({
    organization: organizationId,
    user: userId,
    status: "active",
  });

  if (!membership) {
    return { hasAccess: false, error: "Access denied to this organization" };
  }

  if (permission && !membership.hasPermission(permission)) {
    return {
      hasAccess: false,
      error: `You don't have ${permission} permission`,
    };
  }

  return { hasAccess: true, membership, isPersonal: false };
};

/**
 * Build organization-aware query filter
 * @param {string} userId - The user ID
 * @param {string} organizationId - The organization ID (optional)
 * @param {Object} baseFilter - Additional filter conditions
 * @returns {Object} - MongoDB query filter
 */
export const buildOrgFilter = (userId, organizationId, baseFilter = {}) => {
  if (organizationId) {
    return {
      ...baseFilter,
      organization: organizationId,
    };
  }

  return {
    ...baseFilter,
    admin: userId,
    organization: { $exists: false },
  };
};

/**
 * Get organization from request (query, body, or header)
 * @param {Object} req - Express request object
 * @returns {string|null} - Organization ID or null
 */
export const getOrgFromRequest = (req) => {
  return (
    req.query.organization ||
    req.body.organization ||
    req.headers["x-organization-id"] ||
    null
  );
};
