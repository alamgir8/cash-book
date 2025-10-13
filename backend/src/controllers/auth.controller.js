import * as argon2 from "argon2";
import { Admin } from "../models/Admin.js";
import { createAuthToken } from "../utils/token.js";

export const signup = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    const existing = await Admin.findOne({
      $or: [{ email }, { phone }],
    });

    if (existing) {
      return res.status(409).json({
        message: "An account with this email or phone already exists",
      });
    }

    const passwordHash = await argon2.hash(password);

    const admin = await Admin.create({
      name,
      email,
      phone,
      passwordHash,
    });

    const token = createAuthToken({
      id: admin._id.toString(),
      email: admin.email,
    });

    res.status(201).json({
      token,
      admin: admin.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    const admin = await Admin.findOne({
      $or: [{ email: identifier?.toLowerCase() }, { phone: identifier }],
    });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordValid = await argon2.verify(admin.passwordHash, password);
    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = createAuthToken({
      id: admin._id.toString(),
      email: admin.email,
    });

    res.json({
      token,
      admin: admin.toJSON(),
    });
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
    const { name, email, phone, settings } = req.body;

    // Check if email or phone is being changed and already exists
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

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (settings !== undefined) updateData.settings = settings;

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
