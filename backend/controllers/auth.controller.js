import * as argon2 from "argon2";
import { Admin } from "../models/Admin.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { Category } from "../models/Category.js";
import { OrganizationMember } from "../models/OrganizationMember.js";
import { DEFAULT_CATEGORIES } from "../constants/defaultCategories.js";
import {
  createAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/token.js";

const buildAccessPayload = (admin) => ({
  id: admin._id.toString(),
  email: admin.email,
});

/**
 * Get user's organization memberships
 */
const getUserOrganizations = async (userId) => {
  const memberships = await OrganizationMember.find({
    user: userId,
    status: "active",
  })
    .populate("organization", "name business_type settings")
    .sort({ "organization.name": 1 })
    .lean();

  return memberships.map((m) => ({
    id: m.organization._id,
    name: m.organization.name,
    business_type: m.organization.business_type,
    role: m.role,
    permissions: m.permissions,
    settings: m.organization.settings,
  }));
};

const findReusableRefreshToken = async ({ adminId, userAgent }) => {
  const query = {
    admin: adminId,
    revoked_at: { $exists: false },
  };

  if (userAgent) {
    query.user_agent = userAgent;
  }

  return RefreshToken.findOne(query).sort({ updatedAt: -1 });
};

const issueSessionTokens = async ({ admin, req, refreshTokenDoc }) => {
  const access_token = createAccessToken(buildAccessPayload(admin));
  const {
    token: refresh_token,
    token_hash,
    expires_at,
  } = generateRefreshToken();

  let refreshDoc = refreshTokenDoc;

  if (!refreshDoc) {
    refreshDoc = await findReusableRefreshToken({
      adminId: admin._id,
      userAgent: req.headers["user-agent"],
    });
  }

  if (refreshDoc) {
    refreshDoc.token_hash = token_hash;
    refreshDoc.expires_at = expires_at;
    refreshDoc.user_agent = req.headers["user-agent"];
    refreshDoc.created_ip = req.ip;
    refreshDoc.revoked_at = undefined;
    refreshDoc.replaced_by_token = undefined;
    await refreshDoc.save();
  } else {
    refreshDoc = await RefreshToken.create({
      admin: admin._id,
      token_hash,
      expires_at,
      user_agent: req.headers["user-agent"],
      created_ip: req.ip,
    });
  }

  await RefreshToken.updateMany(
    {
      admin: admin._id,
      _id: { $ne: refreshDoc._id },
      revoked_at: { $exists: false },
      user_agent: req.headers["user-agent"] ?? null,
    },
    { $set: { revoked_at: new Date() } }
  );

  return {
    access_token,
    refresh_token,
    refresh_token_expires_at: expires_at,
    session_id: refreshDoc._id.toString(),
  };
};

export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    const normalizedEmail = email?.toLowerCase();
    const existing = await Admin.findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    });

    if (existing) {
      return res.status(409).json({
        message: "An account with this email or phone already exists",
      });
    }

    const password_hash = await argon2.hash(password);

    const adminPayload = {
      name,
      email: normalizedEmail,
      password_hash,
      security: {
        password_updated_at: new Date(),
      },
    };

    if (phone) {
      adminPayload.phone = phone;
    }

    const admin = await Admin.create(adminPayload);

    if (DEFAULT_CATEGORIES.length > 0) {
      try {
        await Category.insertMany(
          DEFAULT_CATEGORIES.map((category) => ({
            admin: admin._id,
            ...category,
          })),
          { ordered: false }
        );
      } catch (categoryError) {
        if (categoryError.code !== 11000) {
          console.warn("Failed to seed default categories", categoryError);
        }
      }
    }

    const tokens = await issueSessionTokens({ admin, req });

    // New users have no organizations yet
    res.status(201).json({
      admin: admin.toJSON(),
      organizations: [],
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { identifier, email, password, pin } = req.body;

    const normalizedEmail =
      typeof email === "string" ? email.toLowerCase() : undefined;
    const trimmedIdentifier = identifier?.trim();

    const searchConditions = [];

    if (normalizedEmail) {
      searchConditions.push({ email: normalizedEmail });
    }

    if (trimmedIdentifier) {
      if (trimmedIdentifier.includes("@")) {
        searchConditions.push({ email: trimmedIdentifier.toLowerCase() });
      } else {
        searchConditions.push({ phone: trimmedIdentifier });
      }
    }

    if (searchConditions.length === 0) {
      return res.status(400).json({ message: "Provide your email or phone" });
    }

    const admin = await Admin.findOne({
      status: { $ne: "disabled" },
      $or: searchConditions,
    });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    let credentialValid = false;

    if (password) {
      credentialValid = await argon2.verify(admin.password_hash, password);
    }

    if (!credentialValid && pin) {
      const loginPinHash = admin.security?.login_pin_hash;
      if (!loginPinHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      try {
        credentialValid = await argon2.verify(loginPinHash, pin);
      } catch (error) {
        credentialValid = false;
      }
    }

    if (!credentialValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    admin.last_login_at = new Date();
    await admin.save({ validateBeforeSave: false });

    const tokens = await issueSessionTokens({ admin, req });

    // Get user's organizations
    const organizations = await getUserOrganizations(admin._id);

    res.json({
      admin: admin.toJSON(),
      organizations,
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshSession = async (req, res, next) => {
  try {
    const { refresh_token: refreshTokenRaw } = req.body;
    if (!refreshTokenRaw) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const tokenHash = hashToken(refreshTokenRaw);
    const refreshDoc = await RefreshToken.findOne({
      token_hash: tokenHash,
      revoked_at: { $exists: false },
    });

    if (!refreshDoc) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (refreshDoc.expires_at < new Date()) {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    const admin = await Admin.findById(refreshDoc.admin);
    if (!admin || admin.status === "disabled") {
      return res.status(401).json({ message: "Invalid session" });
    }

    const tokens = await issueSessionTokens({
      admin,
      req,
      refreshTokenDoc: refreshDoc,
    });

    // Get user's organizations
    const organizations = await getUserOrganizations(admin._id);

    res.json({
      admin: admin.toJSON(),
      organizations,
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const { refresh_token: refreshTokenRaw } = req.body ?? {};
    if (!refreshTokenRaw) {
      return res.status(200).json({ message: "Logged out" });
    }

    const tokenHash = hashToken(refreshTokenRaw);

    const refreshDoc = await RefreshToken.findOne({
      token_hash: tokenHash,
      admin: req.user?.id,
    });

    if (refreshDoc) {
      refreshDoc.revoked_at = new Date();
      await refreshDoc.save();
    }

    res.json({ message: "Logged out" });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Get user's organizations
    const organizations = await getUserOrganizations(admin._id);

    res.json({
      admin: admin.toJSON(),
      organizations,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      profile_settings: profileSettings,
      login_pin: loginPin,
    } = req.body;

    const normalizedEmail =
      typeof email === "string" ? email.toLowerCase() : undefined;
    const normalizedPhone =
      typeof phone === "string" ? phone.trim() : undefined;

    const updateData = {};
    const unsetData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (normalizedEmail !== undefined) {
      updateData.email = normalizedEmail;
    }

    if (phone !== undefined) {
      updateData.phone = normalizedPhone;
    }

    if (profileSettings !== undefined) {
      Object.entries(profileSettings).forEach(([key, value]) => {
        updateData[`profile_settings.${key}`] = value;
      });
    }

    if (loginPin !== undefined) {
      if (typeof loginPin === "string" && loginPin.trim()) {
        const hashedPin = await argon2.hash(loginPin.trim());
        updateData["security.login_pin_hash"] = hashedPin;
        updateData["security.pin_updated_at"] = new Date();
      } else {
        unsetData["security.login_pin_hash"] = "";
        unsetData["security.pin_updated_at"] = "";
      }
    }

    if (normalizedEmail || normalizedPhone) {
      const existing = await Admin.findOne({
        _id: { $ne: req.user.id },
        $or: [
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      });

      if (existing) {
        return res.status(409).json({
          message: "An account with this email or phone already exists",
        });
      }
    }

    const updatePayload = {};
    if (Object.keys(updateData).length > 0) {
      updatePayload.$set = updateData;
    }
    if (Object.keys(unsetData).length > 0) {
      updatePayload.$unset = unsetData;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: "No changes provided" });
    }

    const admin = await Admin.findByIdAndUpdate(req.user.id, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json({
      message: "Profile updated successfully",
      admin: admin.toJSON(),
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }
    next(error);
  }
};
