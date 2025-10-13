import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    settings: {
      currency: {
        type: String,
        default: 'USD'
      },
      language: {
        type: String,
        default: 'en'
      },
      weekStartsOn: {
        type: Number,
        default: 1
      }
    }
  },
  { timestamps: true }
);

adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export const Admin = mongoose.model('Admin', adminSchema);
