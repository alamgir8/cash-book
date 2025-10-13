import dayjs from "dayjs";

const rangeConfig = {
  daily: () => ({
    start: dayjs().startOf("day"),
    end: dayjs().endOf("day"),
  }),
  weekly: () => ({
    start: dayjs().startOf("week"),
    end: dayjs().endOf("week"),
  }),
  monthly: () => ({
    start: dayjs().startOf("month"),
    end: dayjs().endOf("month"),
  }),
  yearly: () => ({
    start: dayjs().startOf("year"),
    end: dayjs().endOf("year"),
  }),
};

export const buildTransactionFilters = ({ adminId, query }) => {
  const filter = { admin: adminId };

  if (query.accountId) {
    filter.account = query.accountId;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.search) {
    filter.$or = [
      { description: { $regex: query.search, $options: "i" } },
      { comment: { $regex: query.search, $options: "i" } },
    ];
  }

  let startDate;
  let endDate;

  if (query.range && rangeConfig[query.range]) {
    const { start, end } = rangeConfig[query.range]();
    startDate = start;
    endDate = end;
  }

  if (query.startDate) {
    startDate = dayjs(query.startDate);
  }

  if (query.endDate) {
    endDate = dayjs(query.endDate);
  }

  if (startDate || endDate) {
    filter.date = {};
    if (startDate?.isValid()) {
      filter.date.$gte = startDate.startOf("day").toDate();
    }
    if (endDate?.isValid()) {
      filter.date.$lte = endDate.endOf("day").toDate();
    }
  }

  if (query.minAmount || query.maxAmount) {
    filter.amount = {};
    if (query.minAmount) {
      filter.amount.$gte = Number(query.minAmount);
    }
    if (query.maxAmount) {
      filter.amount.$lte = Number(query.maxAmount);
    }
  }

  return filter;
};
