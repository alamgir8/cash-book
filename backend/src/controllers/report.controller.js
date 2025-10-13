import PDFDocument from "pdfkit";
import dayjs from "dayjs";
import { Transaction } from "../models/Transaction.js";
import { Account } from "../models/Account.js";
import { buildTransactionFilters } from "../utils/filters.js";

export const exportTransactionsPdf = async (req, res, next) => {
  try {
    const filter = buildTransactionFilters({
      adminId: req.user.id,
      query: req.query,
    });

    if (req.query.accountName) {
      const accounts = await Account.find({
        admin: req.user.id,
        name: { $regex: req.query.accountName, $options: "i" },
      }).select("_id");

      if (accounts.length === 0) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition"
          // 'attachment; filename="transactions-empty.pdf"'
        );
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        doc.pipe(res);
        doc
          .fontSize(16)
          .text("No transactions found for the requested filters.", {
            align: "center",
          });
        doc.end();
        return;
      }

      filter.account = { $in: accounts.map((item) => item._id) };
    }

    const transactions = await Transaction.find(filter)
      .populate("account", "name type")
      .sort({ date: -1 });

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const filename = `transactions-${dayjs().format("YYYYMMDD-HHmmss")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    doc.pipe(res);

    doc
      .fontSize(20)
      .text("Debit/Credit Transactions Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${dayjs().format("YYYY-MM-DD HH:mm")}`);
    doc.moveDown();

    if (transactions.length === 0) {
      doc.fontSize(14).text("No transactions found for the selected filters.", {
        align: "center",
      });
      doc.end();
      return;
    }

    transactions.forEach((txn) => {
      doc
        .fontSize(12)
        .text(`Date: ${dayjs(txn.date).format("YYYY-MM-DD")}`)
        .text(
          `Account: ${txn.account?.name ?? "N/A"} (${txn.account?.type ?? "-"})`
        )
        .text(`Type: ${txn.type}`)
        .text(`Amount: ${Math.round(txn.amount).toLocaleString()}`)
        .text(`Description: ${txn.description ?? "-"}`)
        .text(`Comment: ${txn.comment ?? "-"}`)
        .text(`Created via voice: ${txn.createdViaVoice ? "Yes" : "No"}`)
        .text(
          `Balance after transaction: ${Math.round(
            txn.balanceAfterTransaction ?? 0
          ).toLocaleString()}`
        )
        .moveDown();
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    next(error);
  }
};
