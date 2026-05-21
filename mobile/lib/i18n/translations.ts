/**
 * App translations
 * Add new languages by adding a new key to the `translations` object.
 * Each language must implement the full `AppTranslations` type.
 */

export type AppTranslations = {
  // ── Common ────────────────────────────────────────────────────────────────
  save: string;
  saveChanges: string;
  cancel: string;
  delete: string;
  edit: string;
  add: string;
  close: string;
  confirm: string;
  loading: string;
  loadingMore: string;
  error: string;
  success: string;
  reset: string;
  apply: string;
  all: string;
  yes: string;
  no: string;
  notNow: string;
  enable: string;
  seeMore: string;
  seeLess: string;
  new: string;
  search: string;
  typeToSearchOrAddNew: string;
  noOptionsAvailable: string;
  showing: string;
  total: string;
  permissionRequired: string;
  cameraPermissionNeeded: string;
  photoLibraryPermissionNeeded: string;
  fileTooLarge: string;
  fileTooLargeAlert: string;
  somethingWentWrong: string;

  // ── Navigation tabs ───────────────────────────────────────────────────────
  tabHome: string;
  tabAccounts: string;
  tabTransactions: string;
  tabShop: string;
  tabSettings: string;

  // ── Auth ─────────────────────────────────────────────────────────────────
  welcomeBack: string;
  manageDebitCreditEasily: string;
  emailOrPhone: string;
  emailOrPhonePlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  sixDigitPin: string;
  enterPin: string;
  usePasswordInstead: string;
  usePinInstead: string;
  signIn: string;
  authenticating: string;
  loginWith: string;
  enableInSettings: string;
  newHere: string;
  createAnAccount: string;
  createAccountTitle: string;
  signUpDescription: string;
  phonePlaceholder: string;
  confirmPassword: string;
  alreadyRegistered: string;
  signInLink: string;
  nameIsRequired: string;
  enterValidEmail: string;
  enterValidPhone: string;
  passwordMinLength: string;
  confirmPasswordPlaceholder: string;
  passwordsDoNotMatch: string;
  enterEmailOrPhone: string;
  enterPasswordOrPin: string;
  pinMustBeSixDigits: string;
  noBiometricCredentials: string;
  enableBiometricTitle: string;
  enableBiometricMessage: string;

  // ── Dashboard ────────────────────────────────────────────────────────────
  dashboard: string;
  trackFinancesEasily: string;
  noTransactionsYet: string;
  startTrackingDescription: string;

  // ── Accounts ─────────────────────────────────────────────────────────────
  accounts: string;
  manageFinancialAccounts: string;
  portfolioOverview: string;
  totalCredit: string;
  acrossAllAccounts: string;
  totalDebit: string;
  overallSpending: string;
  netBalance: string;
  surplusAcrossAccounts: string;
  outstandingBalance: string;
  balance: string;
  netFlow: string;
  viewHistory: string;
  lastActivity: string;
  noActivityYet: string;
  loadingAccounts: string;
  noAccountsYet: string;
  createFirstAccount: string;
  noAccountsAvailable: string;
  createAccount: string;
  newAccount: string;

  // ── Transactions ─────────────────────────────────────────────────────────
  transactions: string;
  allTransactions: string;
  allTransactionsLoaded: string;
  loadMoreTransactions: string;
  exporting: string;
  exportPdf: string;
  noTransactionsFound: string;
  noTransactionsMatchFilters: string;
  addTransaction: string;

  // ── Categories ───────────────────────────────────────────────────────────
  categories: string;
  manageIncomExpenseCategories: string;
  addNew: string;
  expenses: string;
  income: string;
  noCategoriesFound: string;
  addSomeCategoriesDebit: string;
  addSomeCategoriesCredit: string;
  deleteCategory: string;
  deleteCategoryConfirm: string;
  categoryDeletedSuccessfully: string;
  cannotDeleteCategory: string;
  failedToDeleteCategory: string;

  // ── Settings ─────────────────────────────────────────────────────────────
  settings: string;
  profileAndAppPreferences: string;
  deleteMode: string;
  restoreUnlocked: string;
  signOut: string;
  balanceHealthCheck: string;
  verifyAndFixBalances: string;
  manageCategories: string;
  addOrEditCategories: string;
  backupCreatedSuccessfully: string;
  failedToCreateBackup: string;
  pleaseRestoreBackup: string;
  restoreBackupMessage: string;
  selectFile: string;
  backupRestoredSuccessfully: string;
  noDataImported: string;
  failedToRestoreBackup: string;
  invalidBackupFileFormat: string;
  noBackupYet: string;
  tapBackupNowFirst: string;
  couldNotShareBackup: string;

  // ── Profile & Preferences ─────────────────────────────────────────────────
  editProfile: string;
  updateProfileInfo: string;
  personalInformation: string;
  fullName: string;
  yourNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneOptional: string;
  securitySection: string;
  enterNew5DigitPin: string;
  pinWillBeRemoved: string;
  enable5DigitPin: string;
  newPin: string;
  confirmPin: string;
  preferencesSection: string;
  currencyLabel: string;
  selectCurrency: string;
  languageLabel: string;
  selectLanguage: string;
  profileUpdated: string;
  updateFailed: string;
  unableToUpdateProfile: string;
  pinMustBe5Digits: string;
  enterA5DigitPin: string;
  confirmYourPin: string;
  pinsDoNotMatch: string;
  invalidEmailAddress: string;
  personalAccount: string;
  organizationLabel: string;
  owner: string;
  preferences: string;

  // ── Filters ──────────────────────────────────────────────────────────────
  filters: string;
  daily: string;
  weekly: string;
  monthly: string;
  yearly: string;
  today: string;
  last7Days: string;
  last30Days: string;
  thisMonth: string;
  lastMonth: string;
  thisYear: string;
  startDate: string;
  selectStartDate: string;
  endDate: string;
  selectEndDate: string;
  accountFilter: string;
  filterByAccount: string;
  allAccounts: string;
  categoryFilter: string;
  filterByCategory: string;
  allCategories: string;
  counterpartyFilter: string;
  filterByCounterparty: string;
  allCounterparties: string;
  vendorFilter: string;
  filterByVendor: string;
  allVendors: string;
  amountRange: string;
  minPlaceholder: string;
  maxPlaceholder: string;
  searchKeywords: string;
  searchDescriptionPlaceholder: string;
  applyFilters: string;
  filterAll: string;
  filterPaid: string;
  filterDue: string;
  filterLoanGiven: string;
  filterLoanReceived: string;
  filterCredit: string;
  filterDebit: string;

  // ── Transaction card ──────────────────────────────────────────────────────
  paid: string;
  due: string;
  settled: string;
  loanSettledBadge: string;
  theyOwe: string;
  youOwe: string;
  forLabel: string;
  vendorLabel: string;
  pay: string;
  attach: string;

  // ── Stats cards ───────────────────────────────────────────────────────────
  totalIncome: string;
  creditTransactions: string;
  totalExpenses: string;
  debitTransactions: string;
  surplusThisPeriod: string;
  deficitThisPeriod: string;
  thisPeriod: string;
  totalAccounts: string;
  activeAccounts: string;

  // ── Quick actions ─────────────────────────────────────────────────────────
  quickActions: string;
  addTransactionTitle: string;
  recordNewEntry: string;
  transferFundsTitle: string;
  moveBetweenAccounts: string;
  exportPdfTitle: string;
  downloadReport: string;

  // ── Home quick features ───────────────────────────────────────────────────
  quickFeatures: string;
  addIncome: string;
  addExpense: string;
  transfer: string;
  dueUnpaidFeature: string;
  addInvoice: string;
  addCustomer: string;
  invoices: string;
  import: string;
  parties: string;
  reports: string;
  backup: string;
  organizations: string;
  profile: string;

  // ── Transaction modal ─────────────────────────────────────────────────────
  newTransaction: string;
  editTransaction: string;
  recordDebitOrCredit: string;
  updateTransactionDetails: string;
  selectAccount: string;
  loadingCategoriesPlaceholder: string;
  selectCategory: string;
  noCategoriesAvailable: string;
  amountLabel: string;
  transactionType: string;
  dateLabel: string;
  selectDate: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  vendorSellerLabel: string;
  vendorHelpText: string;
  selectOrAddVendor: string;
  paymentMode: string;
  cashPaid: string;
  dueUnpaid: string;
  dueWarning: string;
  dueDateOptional: string;
  selectDueDate: string;
  forBeneficiaryLabel: string;
  counterpartyHelpText: string;
  selectOrAddCounterparty: string;
  additionalNotes: string;
  additionalDetailsPlaceholder: string;
  attachments: string;
  attachmentsHelpText: string;
  scan: string;
  photo: string;
  gallery: string;
  pdf: string;
  amountPreview: string;
  saveTransaction: string;
  updateTransactionBtn: string;
  saveWithAttachments: string;
  uploadingAttachments: string;
  saving: string;
  attachmentUploadFailed: string;
  fileTooLargeMsg: string;
  transactionSavedAttachmentsFailed: string;

  // ── Account form modal ─────────────────────────────────────────────────────
  editAccount: string;
  createAccountSubtitle: string;
  updateAccountDetails: string;
  accountNameLabel: string;
  accountNamePlaceholder: string;
  accountDescriptionLabel: string;
  accountDescriptionOptional: string;
  accountDescriptionPlaceholder: string;
  createAccountBtn: string;
  updateAccountBtn: string;

  // ── Due-chain / Ledger sheet ───────────────────────────────────────────────
  fullLedger: string;
  paymentHistory: string;
  allTransactionsWith: string;
  vendorLabel2: string;
  forLabel2: string;
  dueTransactionChain: string;
  totalGiven: string;
  returnedToMe: string;
  totalBorrowed: string;
  iRepaid: string;
  fullySettled: string;
  iOweThem: string;
  theyOweMe: string;
  iOweThem2: string;
  theyOweThem2: string;
  transactionsTotal: string;
  fullTransactionHistory: string;
  borrowed: string;
  repaid: string;
  loanGiven: string;
  returned: string;
  balance2: string;
  fullyPaid: string;
  notYetPaid: string;
  partiallyPaid: string;
  originalDue: string;
  paid2: string;
  remaining: string;
  settledOn: string;
  transactionTimeline: string;
  noPaymentsYet: string;
  finalPayment: string;
  partialPayment: string;
  afterThis: string;
  left: string;
  couldNotLoad: string;
  nothingToExport: string;
  loadDataFirst: string;
  exportFailed: string;

  // ── Security section ──────────────────────────────────────────────────────
  securityTitle: string;
  protectYourAccount: string;
  biometricLogin: string;
  biometricEnabled: string;
  tapToEnableBiometric: string;
  biometricNotAvailable: string;

  // ── Theme section ─────────────────────────────────────────────────────────
  appearanceTitle: string;
  choosePreferredTheme: string;
  lightMode: string;
  darkMode: string;
  systemDefault: string;
  currentlyUsingDark: string;
  currentlyUsingLight: string;
  themeLight: string;
  themeDark: string;

  // ── Transfer modal ────────────────────────────────────────────────────────
  transferFundsModal: string;
  moveMoneyBetweenAccounts: string;
  fromAccount: string;
  loadingAccountsPlaceholder: string;
  selectSourceAccount: string;
  noAccountsAvailablePlaceholder: string;
  toAccount: string;
  selectDestinationAccount: string;
  noDestinationAccounts: string;
  descriptionTransferPlaceholder: string;
  counterpartyLabel: string;
  transferPreview: string;
  submitTransfer: string;
  submitWithAttachments: string;
  transferSavedAttachmentsFailed: string;
};

// ── English ───────────────────────────────────────────────────────────────────
const en: AppTranslations = {
  save: "Save",
  saveChanges: "Save changes",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  add: "Add",
  close: "Close",
  confirm: "Confirm",
  loading: "Loading...",
  loadingMore: "Loading more...",
  error: "Error",
  success: "Success",
  reset: "Reset",
  apply: "Apply",
  all: "All",
  yes: "Yes",
  no: "No",
  notNow: "Not now",
  enable: "Enable",
  seeMore: "See More",
  seeLess: "See Less",
  new: "New",
  search: "Search",
  typeToSearchOrAddNew: "Type to search or add new",
  noOptionsAvailable: "No options available",
  showing: "Showing",
  total: "total",
  permissionRequired: "Permission Required",
  cameraPermissionNeeded: "Camera access is needed to capture receipts.",
  photoLibraryPermissionNeeded:
    "Photo library access is needed to attach images.",
  fileTooLarge: "File too large. Max 10 MB per file.",
  fileTooLargeAlert: "File Too Large",
  somethingWentWrong: "Something went wrong. Please try again.",

  tabHome: "Home",
  tabAccounts: "Accounts",
  tabTransactions: "Ledger",
  tabShop: "Shop",
  tabSettings: "Settings",

  welcomeBack: "Welcome Back",
  manageDebitCreditEasily:
    "Manage your debit and credit accounts effortlessly.",
  emailOrPhone: "Email or phone",
  emailOrPhonePlaceholder: "Email or phone number",
  password: "Password",
  passwordPlaceholder: "••••••••",
  sixDigitPin: "6-digit PIN",
  enterPin: "Enter PIN",
  usePasswordInstead: "Use password instead",
  usePinInstead: "Use PIN instead",
  signIn: "Sign In",
  authenticating: "Authenticating...",
  loginWith: "Login with",
  enableInSettings: "Enable in Settings → Security",
  newHere: "New here?",
  createAnAccount: "Create an account",
  createAccountTitle: "Create Account",
  signUpDescription: "Sign up with your email or phone number to get started.",
  phonePlaceholder: "Phone number",
  confirmPassword: "Confirm password",
  alreadyRegistered: "Already registered?",
  signInLink: "Sign in",
  nameIsRequired: "Name is required",
  enterValidEmail: "Enter a valid email",
  enterValidPhone: "Enter a valid phone number",
  passwordMinLength: "Password must be at least 8 characters",
  confirmPasswordPlaceholder: "Please confirm your password",
  passwordsDoNotMatch: "Passwords do not match",
  enterEmailOrPhone: "Enter your email or phone",
  enterPasswordOrPin: "Enter your password or PIN",
  pinMustBeSixDigits: "PIN must be 6 digits",
  noBiometricCredentials:
    "No biometric credentials found. Please log in with your password.",
  enableBiometricTitle: "Enable {biometricName}?",
  enableBiometricMessage:
    "Log in faster next time using {biometricName}. Your credentials will be stored securely on this device.",

  dashboard: "Dashboard",
  trackFinancesEasily: "Track your finances easily",
  noTransactionsYet: "No transactions yet",
  startTrackingDescription:
    "Start tracking your finances by adding your first transaction",

  accounts: "Accounts",
  manageFinancialAccounts: "Manage your financial accounts",
  portfolioOverview: "Portfolio Overview",
  totalCredit: "Total Credit",
  acrossAllAccounts: "Across all accounts",
  totalDebit: "Total Debit",
  overallSpending: "Overall spending",
  netBalance: "Net Balance",
  surplusAcrossAccounts: "Surplus across accounts",
  outstandingBalance: "Outstanding balance",
  balance: "Balance",
  netFlow: "Net Flow",
  viewHistory: "View History",
  lastActivity: "Last activity:",
  noActivityYet: "No activity yet",
  loadingAccounts: "Loading accounts...",
  noAccountsYet: "No Accounts Yet",
  createFirstAccount:
    "Create your first account to start tracking your finances.",
  noAccountsAvailable:
    "No accounts available. Contact your organization owner to add accounts.",
  createAccount: "Create Account",
  newAccount: "New Account",

  transactions: "Transactions",
  allTransactions: "All transactions",
  allTransactionsLoaded: "✓ All transactions loaded",
  loadMoreTransactions: "Load More Transactions",
  exporting: "Exporting...",
  exportPdf: "Export PDF",
  noTransactionsFound: "No transactions found",
  noTransactionsMatchFilters: "No transactions match your current filters",
  addTransaction: "Add Transaction",

  categories: "Categories",
  manageIncomExpenseCategories: "Manage income and expense categories",
  addNew: "Add New",
  expenses: "Expenses",
  income: "Income",
  noCategoriesFound: "No categories found",
  addSomeCategoriesDebit: "Add some debit categories to get started",
  addSomeCategoriesCredit: "Add some credit categories to get started",
  deleteCategory: "Delete Category",
  deleteCategoryConfirm:
    'Are you sure you want to delete "{name}"? This cannot be undone.',
  categoryDeletedSuccessfully: "Category deleted successfully",
  cannotDeleteCategory: "Cannot delete category",
  failedToDeleteCategory: "Failed to delete category",

  settings: "Settings",
  profileAndAppPreferences: "Profile and app preferences",
  deleteMode: "Delete mode",
  restoreUnlocked: "Restore unlocked",
  signOut: "Sign Out",
  balanceHealthCheck: "Balance Health Check",
  verifyAndFixBalances:
    "Verify and fix account balances from transaction history",
  manageCategories: "Manage Categories",
  addOrEditCategories: "Add or edit income & expense categories",
  backupCreatedSuccessfully: "Backup created successfully",
  failedToCreateBackup: "Failed to create backup",
  pleaseRestoreBackup: "Restore Backup",
  restoreBackupMessage:
    "This will import data from a backup file. Existing data will NOT be deleted, but duplicate categories will be skipped. Continue?",
  selectFile: "Select File",
  backupRestoredSuccessfully: "Backup restored successfully",
  noDataImported: "No data imported",
  failedToRestoreBackup: "Failed to restore backup",
  invalidBackupFileFormat: "Invalid backup file format",
  noBackupYet: "No backup yet",
  tapBackupNowFirst: "Tap 'Backup Now' first to create a local backup",
  couldNotShareBackup: "Could not share backup",

  editProfile: "Edit Profile",
  updateProfileInfo: "Update your profile information",
  personalInformation: "Personal Information",
  fullName: "Full name",
  yourNamePlaceholder: "Your name",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  phoneOptional: "Phone (optional)",
  securitySection: "Security",
  enterNew5DigitPin: "Enter a new 5-digit PIN to enable quick logins.",
  pinWillBeRemoved: "Your login PIN will be removed when you save changes.",
  enable5DigitPin: "Enable a 5-digit PIN to sign in without your password.",
  newPin: "New PIN",
  confirmPin: "Confirm PIN",
  preferencesSection: "Preferences",
  currencyLabel: "Currency",
  selectCurrency: "Select currency",
  languageLabel: "Language",
  selectLanguage: "Select language",
  profileUpdated: "Profile updated",
  updateFailed: "Update failed",
  unableToUpdateProfile: "Unable to update profile. Try again.",
  pinMustBe5Digits: "PIN must be 5 digits",
  enterA5DigitPin: "Enter a 5-digit PIN",
  confirmYourPin: "Confirm your PIN",
  pinsDoNotMatch: "PINs do not match",
  invalidEmailAddress: "Invalid email address",
  personalAccount: "Personal Account",
  organizationLabel: "Organization",
  owner: "Owner",
  preferences: "Preferences",

  filters: "Filters",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  today: "Today",
  last7Days: "Last 7 Days",
  last30Days: "Last 30 Days",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  thisYear: "This Year",
  startDate: "Start Date",
  selectStartDate: "Select start date",
  endDate: "End Date",
  selectEndDate: "Select end date",
  accountFilter: "Account",
  filterByAccount: "Filter by account",
  allAccounts: "All accounts",
  categoryFilter: "Category",
  filterByCategory: "Filter by category",
  allCategories: "All categories",
  counterpartyFilter: "Counterparty",
  filterByCounterparty: "Filter by counterparty",
  allCounterparties: "All counterparties",
  vendorFilter: "Vendor / Seller",
  filterByVendor: "Filter by vendor",
  allVendors: "All vendors",
  amountRange: "Amount Range",
  minPlaceholder: "Min",
  maxPlaceholder: "Max",
  searchKeywords: "Search Keywords",
  searchDescriptionPlaceholder: "Search description or comments...",
  applyFilters: "Apply Filters",
  filterAll: "All",
  filterPaid: "✓ Paid",
  filterDue: "⏱ Due",
  filterLoanGiven: "↗ Loan Given",
  filterLoanReceived: "↙ Loan Received",
  filterCredit: "Credit",
  filterDebit: "Debit",

  paid: "Paid",
  due: "Due",
  settled: "Settled",
  loanSettledBadge: "Loan Settled",
  theyOwe: "they owe",
  youOwe: "you owe",
  forLabel: "For:",
  vendorLabel: "Vendor:",
  pay: "Pay",
  attach: "Attach",

  totalIncome: "Total Income",
  creditTransactions: "Credit transactions",
  totalExpenses: "Total Expenses",
  debitTransactions: "Debit transactions",
  surplusThisPeriod: "Surplus this period",
  deficitThisPeriod: "Deficit this period",
  thisPeriod: "This period",
  totalAccounts: "Total accounts",
  activeAccounts: "Active Accounts",

  quickActions: "Quick Actions",
  addTransactionTitle: "Add Transaction",
  recordNewEntry: "Record new entry",
  transferFundsTitle: "Transfer Funds",
  moveBetweenAccounts: "Move between accounts",
  exportPdfTitle: "Export PDF",
  downloadReport: "Download report",

  quickFeatures: "Quick Features",
  addIncome: "Add Income",
  addExpense: "Add Expense",
  transfer: "Transfer",
  dueUnpaidFeature: "Due / Unpaid",
  addInvoice: "Add Invoice",
  addCustomer: "Add Customer",
  invoices: "Invoices",
  import: "Import",
  parties: "Parties",
  reports: "Reports",
  backup: "Backup",
  organizations: "Organizations",
  profile: "Profile",

  newTransaction: "New Transaction",
  editTransaction: "Edit Transaction",
  recordDebitOrCredit: "Record your debit or credit",
  updateTransactionDetails: "Update transaction details",
  selectAccount: "Select source account",
  loadingCategoriesPlaceholder: "Loading categories...",
  selectCategory: "Select category",
  noCategoriesAvailable: "No categories available",
  amountLabel: "Amount",
  transactionType: "Type",
  dateLabel: "Date",
  selectDate: "Select Date",
  descriptionLabel: "Description",
  descriptionPlaceholder: "What is this transaction about?",
  vendorSellerLabel: "Vendor / Seller",
  vendorHelpText: "Who did you buy from or sell to? (e.g. Jahangir Alam)",
  selectOrAddVendor: "Select or add vendor name",
  paymentMode: "Payment Mode",
  cashPaid: "Cash / Paid",
  dueUnpaid: "Due / Unpaid",
  dueWarning:
    "This transaction will NOT affect account balance until marked paid.",
  dueDateOptional: "Due Date (Optional)",
  selectDueDate: "Select due date",
  forBeneficiaryLabel: "For / Beneficiary",
  counterpartyHelpText:
    "Who is this expense/income for? (e.g. Wife, Child, Home)",
  selectOrAddCounterparty: "Select or add counterparty",
  additionalNotes: "Additional Notes",
  additionalDetailsPlaceholder: "Any additional details...",
  attachments: "Attachments",
  attachmentsHelpText: "Images ≤1 MB · PDF ≤1.5 MB · JPG, PNG, WebP, HEIC, PDF",
  scan: "Scan",
  photo: "Photo",
  gallery: "Gallery",
  pdf: "PDF",
  amountPreview: "💰 Amount Preview:",
  saveTransaction: "Save Transaction",
  updateTransactionBtn: "Update Transaction",
  saveWithAttachments: "Save with {n} attachment{s}",
  uploadingAttachments: "Uploading attachments…",
  saving: "Saving…",
  attachmentUploadFailed: "Attachment Upload Failed",
  fileTooLargeMsg: "File too large. Max 10 MB per file.",
  transactionSavedAttachmentsFailed:
    "Transaction saved, but attachments could not be uploaded. Try again from the transaction list.",

  // Account form modal
  editAccount: "Edit Account",
  createAccountSubtitle: "Create a new account to track",
  updateAccountDetails: "Update account details",
  accountNameLabel: "Account Name",
  accountNamePlaceholder: "e.g. Business Checking, Savings Account",
  accountDescriptionLabel: "Description",
  accountDescriptionOptional: "(optional)",
  accountDescriptionPlaceholder: "Optional details about this account...",
  createAccountBtn: "Create Account",
  updateAccountBtn: "Update Account",

  // Due-chain / ledger sheet
  fullLedger: "Full Ledger",
  paymentHistory: "Payment History",
  allTransactionsWith: "All transactions with",
  vendorLabel2: "Vendor:",
  forLabel2: "For:",
  dueTransactionChain: "Due transaction chain",
  totalGiven: "Total Given",
  returnedToMe: "Returned to Me",
  totalBorrowed: "Total Borrowed",
  iRepaid: "I Repaid",
  fullySettled: "✅ Fully Settled",
  iOweThem: "⏳ I Owe Them",
  theyOweMe: "⏳ They Owe Me",
  iOweThem2: "I owe them:",
  theyOweThem2: "They owe me:",
  transactionsTotal: "transactions total",
  fullTransactionHistory: "Full Transaction History",
  borrowed: "Borrowed",
  repaid: "Repaid",
  loanGiven: "Loan Given",
  returned: "Returned",
  balance2: "Balance:",
  fullyPaid: "✓ Clear",
  notYetPaid: "⏳ Not Yet Paid",
  partiallyPaid: "⏳ Partially Paid",
  originalDue: "Original Due",
  paid2: "Paid:",
  remaining: "Remaining:",
  settledOn: "Settled on",
  transactionTimeline: "Transaction Timeline",
  noPaymentsYet: "No payments recorded yet",
  finalPayment: "Final Payment",
  partialPayment: "Partial Payment",
  afterThis: "After this:",
  left: "left",
  couldNotLoad: "Could not load history",
  nothingToExport: "Nothing to export",
  loadDataFirst: "Load the data first.",
  exportFailed: "Export failed",

  // Security section
  securityTitle: "Security",
  protectYourAccount: "Protect your account",
  biometricLogin: "Login",
  biometricEnabled: "Enabled - Quick login with biometric",
  tapToEnableBiometric: "Tap to enable quick login",
  biometricNotAvailable: "Not available on this device",

  // Theme section
  appearanceTitle: "Appearance",
  choosePreferredTheme: "Choose your preferred theme",
  lightMode: "Light Mode",
  darkMode: "Dark Mode",
  systemDefault: "System Default",
  currentlyUsingDark: "Currently using Dark Mode (from system settings)",
  currentlyUsingLight: "Currently using Light Mode (from system settings)",
  themeLight: "Theme: Light Mode",
  themeDark: "Theme: Dark Mode",

  transferFundsModal: "Transfer Funds",
  moveMoneyBetweenAccounts: "Move money between your accounts",
  fromAccount: "From Account",
  loadingAccountsPlaceholder: "Loading accounts...",
  selectSourceAccount: "Select source account",
  noAccountsAvailablePlaceholder: "No accounts available",
  toAccount: "To Account",
  selectDestinationAccount: "Select destination account",
  noDestinationAccounts: "No destination accounts available",
  descriptionTransferPlaceholder: "What is this transfer for?",
  counterpartyLabel: "Counterparty",
  transferPreview: "🔄 Transfer Preview:",
  submitTransfer: "Submit Transfer",
  submitWithAttachments: "Submit with {n} attachment{s}",
  transferSavedAttachmentsFailed:
    "Transfer saved, but attachments could not be uploaded.",
};

// ── Bengali (বাংলা) ────────────────────────────────────────────────────────────
const bn: AppTranslations = {
  save: "সংরক্ষণ করুন",
  saveChanges: "পরিবর্তন সংরক্ষণ করুন",
  cancel: "বাতিল",
  delete: "মুছুন",
  edit: "সম্পাদনা",
  add: "যোগ করুন",
  close: "বন্ধ করুন",
  confirm: "নিশ্চিত করুন",
  loading: "লোড হচ্ছে...",
  loadingMore: "আরো লোড হচ্ছে...",
  error: "ত্রুটি",
  success: "সফল",
  reset: "রিসেট",
  apply: "প্রয়োগ করুন",
  all: "সব",
  yes: "হ্যাঁ",
  no: "না",
  notNow: "এখন না",
  enable: "চালু করুন",
  seeMore: "আরো দেখুন",
  seeLess: "কম দেখুন",
  new: "নতুন",
  search: "খুঁজুন",
  typeToSearchOrAddNew: "খুঁজতে টাইপ করুন বা নতুন যোগ করুন",
  noOptionsAvailable: "কোনো বিকল্প নেই",
  showing: "দেখাচ্ছে",
  total: "মোট",
  permissionRequired: "অনুমতি প্রয়োজন",
  cameraPermissionNeeded: "রসিদ ক্যাপচার করতে ক্যামেরার অ্যাক্সেস প্রয়োজন।",
  photoLibraryPermissionNeeded:
    "ছবি যুক্ত করতে ফটো লাইব্রেরির অ্যাক্সেস প্রয়োজন।",
  fileTooLarge: "ফাইল অনেক বড়। প্রতিটি ফাইল সর্বোচ্চ ১০ এমবি।",
  fileTooLargeAlert: "ফাইল অনেক বড়",
  somethingWentWrong: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।",

  tabHome: "হোম",
  tabAccounts: "একাউন্ট",
  tabTransactions: "লেনদেন",
  tabShop: "শপ",
  tabSettings: "সেটিং",

  welcomeBack: "স্বাগতম",
  manageDebitCreditEasily:
    "সহজে আপনার ডেবিট ও ক্রেডিট অ্যাকাউন্ট পরিচালনা করুন।",
  emailOrPhone: "ইমেইল বা ফোন",
  emailOrPhonePlaceholder: "ইমেইল বা ফোন নম্বর",
  password: "পাসওয়ার্ড",
  passwordPlaceholder: "••••••••",
  sixDigitPin: "৬ সংখ্যার পিন",
  enterPin: "পিন দিন",
  usePasswordInstead: "পাসওয়ার্ড ব্যবহার করুন",
  usePinInstead: "পিন ব্যবহার করুন",
  signIn: "সাইন ইন",
  authenticating: "যাচাই হচ্ছে...",
  loginWith: "দিয়ে লগইন করুন",
  enableInSettings: "সেটিংস → সিকিউরিটিতে চালু করুন",
  newHere: "নতুন এখানে?",
  createAnAccount: "একটি অ্যাকাউন্ট তৈরি করুন",
  createAccountTitle: "অ্যাকাউন্ট তৈরি করুন",
  signUpDescription: "শুরু করতে আপনার ইমেইল বা ফোন নম্বর দিয়ে নিবন্ধন করুন।",
  phonePlaceholder: "ফোন নম্বর",
  confirmPassword: "পাসওয়ার্ড নিশ্চিত করুন",
  alreadyRegistered: "ইতিমধ্যে নিবন্ধিত?",
  signInLink: "সাইন ইন করুন",
  nameIsRequired: "নাম আবশ্যিক",
  enterValidEmail: "বৈধ ইমেইল দিন",
  enterValidPhone: "বৈধ ফোন নম্বর দিন",
  passwordMinLength: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে",
  confirmPasswordPlaceholder: "পাসওয়ার্ড নিশ্চিত করুন",
  passwordsDoNotMatch: "পাসওয়ার্ড মিলছে না",
  enterEmailOrPhone: "আপনার ইমেইল বা ফোন দিন",
  enterPasswordOrPin: "আপনার পাসওয়ার্ড বা পিন দিন",
  pinMustBeSixDigits: "পিন অবশ্যই ৬ সংখ্যার হতে হবে",
  noBiometricCredentials:
    "বায়োমেট্রিক তথ্য পাওয়া যায়নি। পাসওয়ার্ড দিয়ে লগইন করুন।",
  enableBiometricTitle: "{biometricName} চালু করবেন?",
  enableBiometricMessage:
    "পরের বার {biometricName} দিয়ে দ্রুত লগইন করুন। আপনার তথ্য নিরাপদে এই ডিভাইসে সংরক্ষিত থাকবে।",

  dashboard: "ড্যাশবোর্ড",
  trackFinancesEasily: "সহজে আপনার অর্থ ট্র্যাক করুন",
  noTransactionsYet: "এখনো কোনো লেনদেন নেই",
  startTrackingDescription:
    "আপনার প্রথম লেনদেন যোগ করে অর্থ ট্র্যাকিং শুরু করুন",

  accounts: "অ্যাকাউন্ট",
  manageFinancialAccounts: "আপনার আর্থিক অ্যাকাউন্ট পরিচালনা করুন",
  portfolioOverview: "পোর্টফোলিও সংক্ষিপ্ত",
  totalCredit: "মোট ক্রেডিট",
  acrossAllAccounts: "সকল অ্যাকাউন্ট মিলিয়ে",
  totalDebit: "মোট ডেবিট",
  overallSpending: "সামগ্রিক ব্যয়",
  netBalance: "নেট ব্যালেন্স",
  surplusAcrossAccounts: "সকল অ্যাকাউন্টে উদ্বৃত্ত",
  outstandingBalance: "বকেয়া ব্যালেন্স",
  balance: "ব্যালেন্স",
  netFlow: "নেট প্রবাহ",
  viewHistory: "ইতিহাস দেখুন",
  lastActivity: "শেষ কার্যক্রম:",
  noActivityYet: "এখনো কোনো কার্যক্রম নেই",
  loadingAccounts: "অ্যাকাউন্ট লোড হচ্ছে...",
  noAccountsYet: "এখনো কোনো অ্যাকাউন্ট নেই",
  createFirstAccount: "অর্থ ট্র্যাকিং শুরু করতে প্রথম অ্যাকাউন্ট তৈরি করুন।",
  noAccountsAvailable:
    "কোনো অ্যাকাউন্ট নেই। অ্যাকাউন্ট যোগ করতে প্রতিষ্ঠানের মালিকের সাথে যোগাযোগ করুন।",
  createAccount: "অ্যাকাউন্ট তৈরি করুন",
  newAccount: "নতুন অ্যাকাউন্ট",

  transactions: "লেনদেন",
  allTransactions: "সকল লেনদেন",
  allTransactionsLoaded: "✓ সকল লেনদেন লোড হয়েছে",
  loadMoreTransactions: "আরো লেনদেন লোড করুন",
  exporting: "এক্সপোর্ট হচ্ছে...",
  exportPdf: "পিডিএফ এক্সপোর্ট",
  noTransactionsFound: "কোনো লেনদেন পাওয়া যায়নি",
  noTransactionsMatchFilters: "বর্তমান ফিল্টারে কোনো লেনদেন নেই",
  addTransaction: "লেনদেন যোগ করুন",

  categories: "ক্যাটাগরি",
  manageIncomExpenseCategories: "আয় ও ব্যয়ের ক্যাটাগরি পরিচালনা করুন",
  addNew: "নতুন যোগ করুন",
  expenses: "ব্যয়",
  income: "আয়",
  noCategoriesFound: "কোনো ক্যাটাগরি পাওয়া যায়নি",
  addSomeCategoriesDebit: "শুরু করতে কিছু ডেবিট ক্যাটাগরি যোগ করুন",
  addSomeCategoriesCredit: "শুরু করতে কিছু ক্রেডিট ক্যাটাগরি যোগ করুন",
  deleteCategory: "ক্যাটাগরি মুছুন",
  deleteCategoryConfirm:
    'আপনি কি "{name}" মুছতে চান? এটি পূর্বাবস্থায় ফেরানো যাবে না।',
  categoryDeletedSuccessfully: "ক্যাটাগরি সফলভাবে মুছে গেছে",
  cannotDeleteCategory: "ক্যাটাগরি মুছা সম্ভব নয়",
  failedToDeleteCategory: "ক্যাটাগরি মুছতে ব্যর্থ হয়েছে",

  settings: "সেটিংস",
  profileAndAppPreferences: "প্রোফাইল এবং অ্যাপ পছন্দ",
  deleteMode: "ডিলিট মোড",
  restoreUnlocked: "রিস্টোর আনলক হয়েছে",
  signOut: "সাইন আউট",
  balanceHealthCheck: "ব্যালেন্স হেলথ চেক",
  verifyAndFixBalances:
    "লেনদেন ইতিহাস থেকে অ্যাকাউন্ট ব্যালেন্স যাচাই ও সংশোধন করুন",
  manageCategories: "ক্যাটাগরি পরিচালনা",
  addOrEditCategories: "আয় ও ব্যয়ের ক্যাটাগরি যোগ বা সম্পাদনা করুন",
  backupCreatedSuccessfully: "ব্যাকআপ সফলভাবে তৈরি হয়েছে",
  failedToCreateBackup: "ব্যাকআপ তৈরিতে ব্যর্থ হয়েছে",
  pleaseRestoreBackup: "ব্যাকআপ রিস্টোর করুন",
  restoreBackupMessage:
    "এটি একটি ব্যাকআপ ফাইল থেকে ডেটা আমদানি করবে। বিদ্যমান ডেটা মুছে যাবে না, তবে ডুপ্লিকেট ক্যাটাগরি বাদ দেওয়া হবে। চালিয়ে যাবেন?",
  selectFile: "ফাইল নির্বাচন করুন",
  backupRestoredSuccessfully: "ব্যাকআপ সফলভাবে রিস্টোর হয়েছে",
  noDataImported: "কোনো ডেটা আমদানি হয়নি",
  failedToRestoreBackup: "ব্যাকআপ রিস্টোরে ব্যর্থ হয়েছে",
  invalidBackupFileFormat: "অবৈধ ব্যাকআপ ফাইল ফরম্যাট",
  noBackupYet: "এখনো কোনো ব্যাকআপ নেই",
  tapBackupNowFirst: "স্থানীয় ব্যাকআপ তৈরি করতে 'এখনই ব্যাকআপ করুন' চাপুন",
  couldNotShareBackup: "ব্যাকআপ শেয়ার করা সম্ভব হয়নি",

  editProfile: "প্রোফাইল সম্পাদনা",
  updateProfileInfo: "আপনার প্রোফাইল তথ্য আপডেট করুন",
  personalInformation: "ব্যক্তিগত তথ্য",
  fullName: "পুরো নাম",
  yourNamePlaceholder: "আপনার নাম",
  emailLabel: "ইমেইল",
  emailPlaceholder: "you@example.com",
  phoneOptional: "ফোন (ঐচ্ছিক)",
  securitySection: "নিরাপত্তা",
  enterNew5DigitPin: "দ্রুত লগইনের জন্য নতুন ৫ সংখ্যার পিন দিন।",
  pinWillBeRemoved: "পরিবর্তন সংরক্ষণ করলে আপনার লগইন পিন সরিয়ে দেওয়া হবে।",
  enable5DigitPin: "পাসওয়ার্ড ছাড়া সাইন ইন করতে ৫ সংখ্যার পিন চালু করুন।",
  newPin: "নতুন পিন",
  confirmPin: "পিন নিশ্চিত করুন",
  preferencesSection: "পছন্দ",
  currencyLabel: "মুদ্রা",
  selectCurrency: "মুদ্রা নির্বাচন করুন",
  languageLabel: "ভাষা",
  selectLanguage: "ভাষা নির্বাচন করুন",
  profileUpdated: "প্রোফাইল আপডেট হয়েছে",
  updateFailed: "আপডেট ব্যর্থ হয়েছে",
  unableToUpdateProfile: "প্রোফাইল আপডেট করা সম্ভব হয়নি। আবার চেষ্টা করুন।",
  pinMustBe5Digits: "পিন অবশ্যই ৫ সংখ্যার হতে হবে",
  enterA5DigitPin: "৫ সংখ্যার পিন দিন",
  confirmYourPin: "আপনার পিন নিশ্চিত করুন",
  pinsDoNotMatch: "পিন মিলছে না",
  invalidEmailAddress: "অবৈধ ইমেইল ঠিকানা",
  personalAccount: "ব্যক্তিগত অ্যাকাউন্ট",
  organizationLabel: "প্রতিষ্ঠান",
  owner: "মালিক",
  preferences: "পছন্দ",

  filters: "ফিল্টার",
  daily: "দৈনিক",
  weekly: "সাপ্তাহিক",
  monthly: "মাসিক",
  yearly: "বার্ষিক",
  today: "আজ",
  last7Days: "শেষ ৭ দিন",
  last30Days: "শেষ ৩০ দিন",
  thisMonth: "এই মাস",
  lastMonth: "গত মাস",
  thisYear: "এই বছর",
  startDate: "শুরুর তারিখ",
  selectStartDate: "শুরুর তারিখ নির্বাচন করুন",
  endDate: "শেষের তারিখ",
  selectEndDate: "শেষের তারিখ নির্বাচন করুন",
  accountFilter: "অ্যাকাউন্ট",
  filterByAccount: "অ্যাকাউন্ট দিয়ে ফিল্টার করুন",
  allAccounts: "সকল অ্যাকাউন্ট",
  categoryFilter: "ক্যাটাগরি",
  filterByCategory: "ক্যাটাগরি দিয়ে ফিল্টার করুন",
  allCategories: "সকল ক্যাটাগরি",
  counterpartyFilter: "কাউন্টারপার্টি",
  filterByCounterparty: "কাউন্টারপার্টি দিয়ে ফিল্টার করুন",
  allCounterparties: "সকল কাউন্টারপার্টি",
  vendorFilter: "বিক্রেতা",
  filterByVendor: "বিক্রেতা দিয়ে ফিল্টার করুন",
  allVendors: "সকল বিক্রেতা",
  amountRange: "পরিমাণের পরিসর",
  minPlaceholder: "সর্বনিম্ন",
  maxPlaceholder: "সর্বোচ্চ",
  searchKeywords: "কীওয়ার্ড খুঁজুন",
  searchDescriptionPlaceholder: "বিবরণ বা মন্তব্য খুঁজুন...",
  applyFilters: "ফিল্টার প্রয়োগ করুন",
  filterAll: "সব",
  filterPaid: "✓ পরিশোধিত",
  filterDue: "⏱ বকেয়া",
  filterLoanGiven: "↗ ঋণ দেওয়া",
  filterLoanReceived: "↙ ঋণ নেওয়া",
  filterCredit: "ক্রেডিট",
  filterDebit: "ডেবিট",

  paid: "পরিশোধিত",
  due: "বকেয়া",
  settled: "নিষ্পত্তি হয়েছে",
  loanSettledBadge: "ঋণ নিষ্পত্তি",
  theyOwe: "তারা বকেয়া",
  youOwe: "আপনি বকেয়া",
  forLabel: "জন্য:",
  vendorLabel: "বিক্রেতা:",
  pay: "পরিশোধ করুন",
  attach: "সংযুক্ত করুন",

  totalIncome: "মোট আয়",
  creditTransactions: "ক্রেডিট লেনদেন",
  totalExpenses: "মোট ব্যয়",
  debitTransactions: "ডেবিট লেনদেন",
  surplusThisPeriod: "এই সময়কালে উদ্বৃত্ত",
  deficitThisPeriod: "এই সময়কালে ঘাটতি",
  thisPeriod: "এই সময়কাল",
  totalAccounts: "মোট অ্যাকাউন্ট",
  activeAccounts: "সক্রিয় অ্যাকাউন্ট",

  quickActions: "দ্রুত কার্যক্রম",
  addTransactionTitle: "লেনদেন যোগ করুন",
  recordNewEntry: "নতুন এন্ট্রি রেকর্ড করুন",
  transferFundsTitle: "তহবিল স্থানান্তর",
  moveBetweenAccounts: "অ্যাকাউন্টের মধ্যে স্থানান্তর করুন",
  exportPdfTitle: "পিডিএফ এক্সপোর্ট",
  downloadReport: "রিপোর্ট ডাউনলোড করুন",

  quickFeatures: "দ্রুত বৈশিষ্ট্য",
  addIncome: "আয় যোগ করুন",
  addExpense: "ব্যয় যোগ করুন",
  transfer: "স্থানান্তর",
  dueUnpaidFeature: "বকেয়া / অপরিশোধিত",
  addInvoice: "ইনভয়েস যোগ করুন",
  addCustomer: "গ্রাহক যোগ করুন",
  invoices: "ইনভয়েস",
  import: "আমদানি",
  parties: "পার্টি",
  reports: "রিপোর্ট",
  backup: "ব্যাকআপ",
  organizations: "প্রতিষ্ঠান",
  profile: "প্রোফাইল",

  newTransaction: "নতুন লেনদেন",
  editTransaction: "লেনদেন সম্পাদনা",
  recordDebitOrCredit: "আপনার ডেবিট বা ক্রেডিট রেকর্ড করুন",
  updateTransactionDetails: "লেনদেনের বিবরণ আপডেট করুন",
  selectAccount: "উৎস অ্যাকাউন্ট নির্বাচন করুন",
  loadingCategoriesPlaceholder: "ক্যাটাগরি লোড হচ্ছে...",
  selectCategory: "ক্যাটাগরি নির্বাচন করুন",
  noCategoriesAvailable: "কোনো ক্যাটাগরি নেই",
  amountLabel: "পরিমাণ",
  transactionType: "ধরন",
  dateLabel: "তারিখ",
  selectDate: "তারিখ নির্বাচন করুন",
  descriptionLabel: "বিবরণ",
  descriptionPlaceholder: "এই লেনদেন কী বিষয়ে?",
  vendorSellerLabel: "বিক্রেতা / সরবরাহকারী",
  vendorHelpText:
    "আপনি কার কাছ থেকে কিনেছেন বা কার কাছে বিক্রি করেছেন? (যেমন: জাহাঙ্গীর আলম)",
  selectOrAddVendor: "বিক্রেতার নাম নির্বাচন বা যোগ করুন",
  paymentMode: "পেমেন্ট পদ্ধতি",
  cashPaid: "নগদ / পরিশোধিত",
  dueUnpaid: "বকেয়া / অপরিশোধিত",
  dueWarning:
    "পরিশোধিত চিহ্নিত না করা পর্যন্ত এই লেনদেন অ্যাকাউন্ট ব্যালেন্সে প্রভাব ফেলবে না।",
  dueDateOptional: "বকেয়ার তারিখ (ঐচ্ছিক)",
  selectDueDate: "বকেয়ার তারিখ নির্বাচন করুন",
  forBeneficiaryLabel: "জন্য / সুবিধাভোগী",
  counterpartyHelpText: "এই ব্যয়/আয় কার জন্য? (যেমন: স্ত্রী, সন্তান, বাড়ি)",
  selectOrAddCounterparty: "কাউন্টারপার্টি নির্বাচন বা যোগ করুন",
  additionalNotes: "অতিরিক্ত নোট",
  additionalDetailsPlaceholder: "যেকোনো অতিরিক্ত বিবরণ...",
  attachments: "সংযুক্তি",
  attachmentsHelpText:
    "ছবি ≤১ এমবি · পিডিএফ ≤১.৫ এমবি · JPG, PNG, WebP, HEIC, PDF",
  scan: "স্ক্যান",
  photo: "ছবি",
  gallery: "গ্যালারি",
  pdf: "পিডিএফ",
  amountPreview: "💰 পরিমাণ প্রিভিউ:",
  saveTransaction: "লেনদেন সংরক্ষণ করুন",
  updateTransactionBtn: "লেনদেন আপডেট করুন",
  saveWithAttachments: "{n}টি সংযুক্তিসহ সংরক্ষণ করুন",
  uploadingAttachments: "সংযুক্তি আপলোড হচ্ছে…",
  saving: "সংরক্ষণ হচ্ছে…",
  attachmentUploadFailed: "সংযুক্তি আপলোড ব্যর্থ হয়েছে",
  fileTooLargeMsg: "ফাইল অনেক বড়। প্রতিটি ফাইল সর্বোচ্চ ১০ এমবি।",
  transactionSavedAttachmentsFailed:
    "লেনদেন সংরক্ষিত হয়েছে, কিন্তু সংযুক্তি আপলোড হয়নি। লেনদেন তালিকা থেকে আবার চেষ্টা করুন।",

  // Account form modal
  editAccount: "অ্যাকাউন্ট সম্পাদনা",
  createAccountSubtitle: "ট্র্যাক করতে নতুন অ্যাকাউন্ট তৈরি করুন",
  updateAccountDetails: "অ্যাকাউন্টের বিবরণ আপডেট করুন",
  accountNameLabel: "অ্যাকাউন্টের নাম",
  accountNamePlaceholder: "যেমন: ব্যবসায়িক চেকিং, সঞ্চয় অ্যাকাউন্ট",
  accountDescriptionLabel: "বিবরণ",
  accountDescriptionOptional: "(ঐচ্ছিক)",
  accountDescriptionPlaceholder: "এই অ্যাকাউন্ট সম্পর্কে ঐচ্ছিক বিবরণ...",
  createAccountBtn: "অ্যাকাউন্ট তৈরি করুন",
  updateAccountBtn: "অ্যাকাউন্ট আপডেট করুন",

  // Due-chain / ledger sheet
  fullLedger: "সম্পূর্ণ লেজার",
  paymentHistory: "পেমেন্ট ইতিহাস",
  allTransactionsWith: "সাথে সকল লেনদেন",
  vendorLabel2: "বিক্রেতা:",
  forLabel2: "জন্য:",
  dueTransactionChain: "বকেয়া লেনদেন চেইন",
  totalGiven: "মোট দিয়েছি",
  returnedToMe: "আমাকে ফেরত দিয়েছে",
  totalBorrowed: "মোট ধার নিয়েছি",
  iRepaid: "আমি পরিশোধ করেছি",
  fullySettled: "✅ সম্পূর্ণ নিষ্পত্তি হয়েছে",
  iOweThem: "⏳ আমি তাদের কাছে বকেয়া",
  theyOweMe: "⏳ তারা আমার কাছে বকেয়া",
  iOweThem2: "আমি তাদের কাছে বকেয়া:",
  theyOweThem2: "তারা আমার কাছে বকেয়া:",
  transactionsTotal: "টি লেনদেন মোট",
  fullTransactionHistory: "সম্পূর্ণ লেনদেন ইতিহাস",
  borrowed: "ধার নিয়েছি",
  repaid: "পরিশোধ করেছি",
  loanGiven: "ঋণ দিয়েছি",
  returned: "ফেরত দিয়েছি",
  balance2: "ব্যালেন্স:",
  fullyPaid: "✓ পরিষ্কার",
  notYetPaid: "⏳ এখনো পরিশোধ হয়নি",
  partiallyPaid: "⏳ আংশিক পরিশোধিত",
  originalDue: "মূল বকেয়া",
  paid2: "পরিশোধিত:",
  remaining: "বাকি:",
  settledOn: "নিষ্পত্তির তারিখ:",
  transactionTimeline: "লেনদেন টাইমলাইন",
  noPaymentsYet: "এখনো কোনো পেমেন্ট রেকর্ড নেই",
  finalPayment: "চূড়ান্ত পেমেন্ট",
  partialPayment: "আংশিক পেমেন্ট",
  afterThis: "এরপর:",
  left: "বাকি",
  couldNotLoad: "ইতিহাস লোড করা সম্ভব হয়নি",
  nothingToExport: "এক্সপোর্ট করার কিছু নেই",
  loadDataFirst: "প্রথমে ডেটা লোড করুন।",
  exportFailed: "এক্সপোর্ট ব্যর্থ হয়েছে",

  // Security section
  securityTitle: "নিরাপত্তা",
  protectYourAccount: "আপনার অ্যাকাউন্ট সুরক্ষিত করুন",
  biometricLogin: "লগইন",
  biometricEnabled: "চালু আছে - বায়োমেট্রিক দিয়ে দ্রুত লগইন",
  tapToEnableBiometric: "দ্রুত লগইন চালু করতে চাপুন",
  biometricNotAvailable: "এই ডিভাইসে উপলব্ধ নয়",

  // Theme section
  appearanceTitle: "চেহারা",
  choosePreferredTheme: "আপনার পছন্দের থিম বেছে নিন",
  lightMode: "লাইট মোড",
  darkMode: "ডার্ক মোড",
  systemDefault: "সিস্টেম ডিফল্ট",
  currentlyUsingDark: "বর্তমানে ডার্ক মোড ব্যবহার হচ্ছে (সিস্টেম সেটিংস থেকে)",
  currentlyUsingLight: "বর্তমানে লাইট মোড ব্যবহার হচ্ছে (সিস্টেম সেটিংস থেকে)",
  themeLight: "থিম: লাইট মোড",
  themeDark: "থিম: ডার্ক মোড",

  transferFundsModal: "তহবিল স্থানান্তর",
  moveMoneyBetweenAccounts: "আপনার অ্যাকাউন্টগুলোর মধ্যে অর্থ স্থানান্তর করুন",
  fromAccount: "প্রেরণ অ্যাকাউন্ট",
  loadingAccountsPlaceholder: "অ্যাকাউন্ট লোড হচ্ছে...",
  selectSourceAccount: "উৎস অ্যাকাউন্ট নির্বাচন করুন",
  noAccountsAvailablePlaceholder: "কোনো অ্যাকাউন্ট নেই",
  toAccount: "প্রাপ্তি অ্যাকাউন্ট",
  selectDestinationAccount: "গন্তব্য অ্যাকাউন্ট নির্বাচন করুন",
  noDestinationAccounts: "কোনো গন্তব্য অ্যাকাউন্ট নেই",
  descriptionTransferPlaceholder: "এই স্থানান্তর কী কারণে?",
  counterpartyLabel: "কাউন্টারপার্টি",
  transferPreview: "🔄 স্থানান্তর প্রিভিউ:",
  submitTransfer: "স্থানান্তর জমা দিন",
  submitWithAttachments: "{n}টি সংযুক্তিসহ জমা দিন",
  transferSavedAttachmentsFailed:
    "স্থানান্তর সংরক্ষিত হয়েছে, কিন্তু সংযুক্তি আপলোড হয়নি।",
};

export const translations: Record<string, AppTranslations> = { en, bn };
export type SupportedLanguage = keyof typeof translations;
