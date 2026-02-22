import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const { Import } = await import("../models/Import.js");
const latest = await Import.findOne().sort({ createdAt: -1 }).lean();

console.log("File:", latest.original_filename);
console.log("Mode:", latest.import_mode);
console.log("Cols count:", latest.detected_columns.length);
console.log("Metadata:", JSON.stringify(latest.parser_metadata));
console.log("Mapping:", JSON.stringify(latest.column_mapping));

console.log("\nAll columns:");
latest.detected_columns.forEach((c, i) => console.log(i + ":", c));

const statusCounts = {};
const typeCounts = {};
let nullDates = 0;
for (const item of latest.items) {
  statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
  typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  if (!item.date) nullDates++;
}
console.log("\nStatus:", JSON.stringify(statusCounts));
console.log("Types:", JSON.stringify(typeCounts));
console.log("Null dates:", nullDates);

console.log("\nFirst 5 items:");
for (const item of latest.items.slice(0, 5)) {
  console.log(
    JSON.stringify({
      idx: item.row_index,
      date: item.date,
      desc: item.description?.substring(0, 40),
      amount: item.amount,
      type: item.type,
      status: item.status,
      err: item.error_message,
    }),
  );
}
console.log("\nFirst 5 skipped:");
for (const item of latest.items
  .filter((i) => i.status === "skipped")
  .slice(0, 5)) {
  console.log(
    JSON.stringify({
      idx: item.row_index,
      date: item.date,
      desc: item.description?.substring(0, 40),
      amount: item.amount,
      type: item.type,
      err: item.error_message,
    }),
  );
}

await mongoose.disconnect();
process.exit(0);
