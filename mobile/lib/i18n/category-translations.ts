/**
 * Category name and group translations.
 * Since categories are stored in English in the backend, we translate them
 * on the frontend using this static mapping.
 */

// Maps English category names → locale translations
const categoryNameTranslations: Record<string, Record<string, string>> = {
  bn: {
    // Income / Credit
    Salary: "বেতন",
    "Business Income": "ব্যবসায়িক আয়",
    "Investment Return": "বিনিয়োগ রিটার্ন",
    "Product Sales": "পণ্য বিক্রয়",
    "Service Sales": "সেবা বিক্রয়",
    "Donations In": "প্রাপ্ত দান",
    "Loan Received": "ঋণ পেয়েছি",
    "Loan Repayment Received": "ঋণ ফেরত পেয়েছি",
    "Adjustment (Credit)": "সমন্বয় (ক্রেডিট)",
    "Other Credit": "অন্যান্য ক্রেডিট",

    // Expense / Debit
    Rent: "ভাড়া",
    Utilities: "ইউটিলিটি",
    "Food & Dining": "খাবার ও রেস্তোরাঁ",
    Transportation: "পরিবহন",
    Healthcare: "স্বাস্থ্যসেবা",
    Education: "শিক্ষা",
    Entertainment: "বিনোদন",
    "Inventory Purchase": "মজুদ ক্রয়",
    "Equipment Purchase": "সরঞ্জাম ক্রয়",
    "Loan Given": "ঋণ দিয়েছি",
    "Loan Repayment Paid": "ঋণ পরিশোধ করেছি",
    "Donations Out": "প্রদত্ত দান",
    "Employee Salary": "কর্মচারী বেতন",
    "Adjustment (Debit)": "সমন্বয় (ডেবিট)",
    "Other Debit": "অন্যান্য ডেবিট",
  },
};

// Maps category type key → locale group label
const categoryGroupTranslations: Record<string, Record<string, string>> = {
  bn: {
    income: "আয়",
    sell: "বিক্রয়",
    donation_in: "দান (প্রাপ্ত)",
    loan_in: "ঋণ (প্রাপ্ত)",
    adjustment_in: "সমন্বয় (ইন)",
    other_income: "অন্যান্য আয়",
    expense: "খরচ",
    purchase: "ক্রয়",
    loan_out: "ঋণ (প্রদত্ত)",
    donation_out: "দান (প্রদত্ত)",
    salary: "বেতন",
    adjustment_out: "সমন্বয় (আউট)",
    other_expense: "অন্যান্য খরচ",
  },
};

const flowTranslations: Record<string, Record<string, string>> = {
  bn: {
    Credit: "ক্রেডিট",
    Debit: "ডেবিট",
  },
};

/**
 * Translate a category name. Falls back to the original English name
 * if the language is "en" or no translation is found.
 */
export function translateCategoryName(name: string, language: string): string {
  if (language === "en") return name;
  return categoryNameTranslations[language]?.[name] ?? name;
}

/**
 * Translate a category group label (derived from type key).
 * The `rawLabel` is the already-formatted English string (e.g. "Loan Out").
 * The `typeKey` is the raw type from the API (e.g. "loan_out").
 */
export function translateCategoryGroup(
  typeKey: string,
  rawLabel: string,
  language: string,
): string {
  if (language === "en") return rawLabel;
  return categoryGroupTranslations[language]?.[typeKey] ?? rawLabel;
}

/**
 * Translate "Credit" / "Debit" flow subtitle.
 */
export function translateFlow(flow: string, language: string): string {
  if (language === "en") return flow;
  return flowTranslations[language]?.[flow] ?? flow;
}
