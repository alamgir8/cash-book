import * as argon2 from "argon2";
import { Admin } from "../models/Admin.js";
import { RefreshToken } from "../models/RefreshToken.js";
import {
  createAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/token.js";

const buildAccessPayload = (admin) => ({
  id: admin._id.toString(),
  email: admin.email,
});

const issueSessionTokens = async ({ admin, req, previousTokenDoc }) => {
  const access_token = createAccessToken(buildAccessPayload(admin));
  const { token: refresh_token, token_hash, expires_at } =
    generateRefreshToken();

  const refreshDoc = await RefreshToken.create({
    admin: admin._id,
    token_hash,
    expires_at,
    user_agent: req.headers["user-agent"],
    created_ip: req.ip,
  });

  if (previousTokenDoc) {
    previousTokenDoc.revoked_at = new Date();
    previousTokenDoc.replaced_by_token = token_hash;
    await previousTokenDoc.save();
  }

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

    const tokens = await issueSessionTokens({ admin, req });

    res.status(201).json({
      admin: admin.toJSON(),
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.toLowerCase();

    const admin = await Admin.findOne({
      email: normalizedEmail,
      status: { $ne: "disabled" },
    });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordValid = await argon2.verify(admin.password_hash, password);
    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    admin.last_login_at = new Date();
    await admin.save({ validateBeforeSave: false });

    const tokens = await issueSessionTokens({ admin, req });

    res.json({
      admin: admin.toJSON(),
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
      previousTokenDoc: refreshDoc,
    });

    res.json({
      admin: admin.toJSON(),
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
    res.json({ admin: admin.toJSON() });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone, profile_settings: profileSettings } = req.body;

    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (email !== undefined) {
      updateData.email = email.toLowerCase();
    }

    if (phone !== undefined) {
      updateData.phone = phone;
    }

    if (profileSettings !== undefined) {
      Object.entries(profileSettings).forEach(([key, value]) => {
        updateData[`profile_settings.${key}`] = value;
      });
    }

    if (email || phone) {
      const existing = await Admin.findOne({
        _id: { $ne: req.user.id },
        $or: [
          ...(email ? [{ email: email.toLowerCase() }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      });

      if (existing) {
        return res.status(409).json({
          message: "An account with this email or phone already exists",
        });
      }
    }

    const admin = await Admin.findByIdAndUpdate(req.user.id, updateData, {
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
