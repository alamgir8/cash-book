import mongoose from "mongoose";
import { Transaction } from "../models/Transaction.js";
import { Category } from "../models/Category.js";
import { Admin } from "../models/Admin.js";

await mongoose.connect(process.env.MONGODB_URI);
const admin = await Admin.findOne({ email: "alamgir@gmail.com" }).lean();
const adminId = admin._id;

const loanCats = await Category.find({
  admin: adminId,
  type: { $in: ["loan_in", "loan_out"] },
}).lean();
console.log(
  "Loan cats:",
  loanCats.map((c) => `${c.name} (${c.type})`).join(", "),
);
const loanCatIds = loanCats.map((c) => c._id);
const catNameById = Object.fromEntries(
  loanCats.map((c) => [c._id.toString(), c.name]),
);

// মসজিদ
const mt = await Transaction.find({
  admin: adminId,
  counterparty: "মসজিদ",
  category_id: { $in: loanCatIds },
  is_deleted: { $ne: true },
})
  .populate("category_id", "name type")
  .sort({ date: 1, createdAt: 1 })
  .lean();
console.log(`\n=== মসজিদ (${mt.length} loan txns) ===`);
let owedByMe = 0,
  owedByThem = 0;
for (const t of mt) {
  const n = t.category_id?.name ?? "?";
  if (n === "Loan Received") owedByMe += t.amount;
  else if (n === "Loan Repayment Paid")
    owedByMe = Math.max(0, owedByMe - t.amount);
  else if (n === "Loan Given") owedByThem += t.amount;
  else if (n === "Loan Repayment Received")
    owedByThem = Math.max(0, owedByThem - t.amount);
  console.log(
    `  ${t.date?.toISOString().slice(0, 10)} | ${n.padEnd(28)} ৳${String(t.amount).padStart(8)} | owedByMe=${owedByMe} owedByThem=${owedByThem} | "${t.description}"`,
  );
}
console.log(
  `FINAL: owedByMe=${owedByMe} owedByThem=${owedByThem} net_owe=${owedByMe - owedByThem}`,
);

// শাহানা আন্টি ALL txns
const st = await Transaction.find({
  admin: adminId,
  counterparty: { $regex: /শাহানা/i },
  is_deleted: { $ne: true },
})
  .populate("category_id", "name type")
  .sort({ date: 1 })
  .lean();
console.log(`\n=== শাহানা আন্টি ALL (${st.length} txns) ===`);
for (const t of st) {
  const n = t.category_id?.name ?? "?";
  const tp = t.category_id?.type ?? "?";
  console.log(
    `  ${t.date?.toISOString().slice(0, 10)} | ${n.padEnd(28)} (${tp}) ৳${t.amount} | "${t.description}"`,
  );
}

await mongoose.disconnect();
