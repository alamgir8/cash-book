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
  switchAccount: string;
  switchAccountHint: string;
  switchAccountConfirm: string;
  signOutConfirm: string;
  balanceHealthCheck: string;
  verifyAndFixBalances: string;
  manageCategories: string;
  addOrEditCategories: string;
  // Collection schemes
  collectionSchemes: string;
  collectionSchemesSubtitle: string;
  collectionScheme: string;
  selectSchemeOptional: string;
  createScheme: string;
  createLabel: string;
  archiveLabel: string;
  removeLabel: string;
  schemeName: string;
  schemeNamePlaceholder: string;
  schemeNameRequired: string;
  schemeRateRequired: string;
  ratePerMember: string;
  descriptionOptional: string;
  notesOptional: string;
  schemeDescriptionPlaceholder: string;
  schemeCreated: string;
  schemeCreateFailed: string;
  editScheme: string;
  schemeUpdated: string;
  schemeUpdateFailed: string;
  duplicateScheme: string;
  duplicateSchemeName: string;
  duplicateSchemeNamePlaceholder: string;
  duplicateSchemeHint: string;
  duplicateLabel: string;
  schemeDuplicated: string;
  schemeDuplicateFailed: string;
  deleteScheme: string;
  deleteSchemeConfirm: string;
  deleteSchemeHasFamilies: string;
  deleteLabel: string;
  schemeDeleted: string;
  deleteFailed: string;
  archiveScheme: string;
  archiveSchemeConfirm: string;
  schemeArchived: string;
  schemeArchiveFailed: string;
  noSchemesYet: string;
  noSchemesYetHint: string;
  familiesCount: string;
  families: string;
  statusPaid: string;
  statusPartial: string;
  statusDue: string;
  expected: string;
  searchFamilies: string;
  noFamiliesInScheme: string;
  noFamiliesInSchemeHint: string;
  enrollFamily: string;
  enrollFamilyHint: string;
  family: string;
  selectFamily: string;
  selectFamilyRequired: string;
  memberCount: string;
  memberCountRequired: string;
  sortOrder: string;
  sortOrderHint: string;
  sortOrderRequired: string;
  membersLabel: string;
  enroll: string;
  familyEnrolled: string;
  enrollFailed: string;
  partyAdded: string;
  recordPayment: string;
  paymentRecorded: string;
  paymentFailed: string;
  amountRequired: string;
  removeFromScheme: string;
  removeFromSchemeConfirm: string;
  memberRemoved: string;
  cannotRemoveFamilyWithPayments: string;
  editFamily: string;
  deleteFamily: string;
  updateMemberCount: string;
  updateMemberCountHint: string;
  memberUpdated: string;
  memberUpdateFailed: string;
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
  noteLabel: string;
  schemeLabel: string;
  balanceAfterLabel: string;
  dueDateLabel: string;
  transferIn: string;
  transferOut: string;
  pay: string;
  returnLoan: string;
  returnAmount: string;
  recordFullReturn: string;
  recordPartialReturn: string;
  noteOptional: string;
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
  selectOrAddVendors: string;
  selectOrAddCounterparties: string;
  bulkTransactions: string;
  bulkTransactionsHintOn: string;
  bulkTransactionsHintOff: string;
  bulkModeConflict: string;
  bulkModeConflictHint: string;
  bulkSamePartyBothSides: string;
  bulkSamePartyBothSidesHint: string;
  bulkCollapsedToSingle: string;
  bulkCollapsedToSingleHint: string;
  bulkKeptSingleCounterparty: string;
  bulkKeptSingleCounterpartyHint: string;
  bulkKeptSingleVendor: string;
  bulkKeptSingleVendorHint: string;
  bulkVendorSingleOnly: string;
  bulkVendorSingleOnlyHint: string;
  bulkCounterpartySingleOnly: string;
  bulkCounterpartySingleOnlyHint: string;
  saveBulkTransactions: string;
  failedToAddParty: string;
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

  // ── Shop / POS / Products / Invoices ──────────────────────────────────────
  shop: string;
  shopDashboard: string;
  newSale: string;
  saleInvoice: string;
  newPurchase: string;
  addProduct: string;
  todaysSales: string;
  todaysPurchases: string;
  inventory: string;
  totalProducts: string;
  lowStock: string;
  stockValue: string;
  outOfStock: string;
  inStock: string;
  noTracking: string;
  products: string;
  productName: string;
  productNamePlaceholder: string;
  brand: string;
  brandOptional: string;
  brandPlaceholder: string;
  suggestBrands: string;
  suggestProducts: string;
  sku: string;
  skuAutoHint: string;
  barcode: string;
  barcodeOptional: string;
  barcodePlaceholder: string;
  scanBarcode: string;
  scanProductBarcode: string;
  scanItemBarcode: string;
  scanItem: string;
  barcodeDetected: string;
  pointCameraAtBarcode: string;
  cameraPermissionRequired: string;
  grantPermission: string;
  description: string;
  unit: string;
  pricing: string;
  purchasePrice: string;
  salePrice: string;
  additionalCost: string;
  additionalCostHint: string;
  costPrice: string;
  taxRate: string;
  profitMargin: string;
  openingStock: string;
  lowStockAlert: string;
  trackInventory: string;
  trackInventoryHint: string;
  active: string;
  inactive: string;
  details: string;
  stockHistory: string;
  currentStock: string;
  adjustStock: string;
  addStock: string;
  removeStock: string;
  quantity: string;
  quantityPlaceholder: string;
  unitCostOptional: string;
  unitCostPlaceholder: string;
  adjustmentNotesPlaceholder: string;
  confirmAdjustment: string;
  stockAdjustedSuccess: string;
  insufficientStock: string;
  noStockMovements: string;
  adjustmentIn: string;
  adjustmentOut: string;
  purchase: string;
  sale: string;
  purchaseReturn: string;
  saleReturn: string;
  openingStockMovement: string;
  noProductsFound: string;
  noProductsLowStock: string;
  tapToAddFirstProduct: string;
  searchProductsPlaceholder: string;
  productCreated: string;
  productUpdated: string;
  productDeleted: string;
  deleteProductTitle: string;
  deleteProductMessage: string;
  notInCatalog: string;
  createProductInline: string;
  newProduct: string;
  noBarcode: string;
  restockRequired: string;
  invoice: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  reference: string;
  referenceOptional: string;
  terms: string;
  internalNotes: string;
  customer: string;
  supplier: string;
  selectCustomer: string;
  selectSupplier: string;
  searchCustomersPlaceholder: string;
  searchSuppliersPlaceholder: string;
  walkInCustomer: string;
  lineItems: string;
  addItem: string;
  customerRequired: string;
  discountOptional: string;
  discount: string;
  discountType: string;
  shippingCharge: string;
  adjustment: string;
  adjustmentDescription: string;
  invoiceDetails: string;
  subTotal: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  amountReceived: string;
  paymentMethod: string;
  depositToAccount: string;
  selectAccountPlaceholder: string;
  selectAccountForPayment: string;
  cash: string;
  bank: string;
  mobileWallet: string;
  cheque: string;
  other: string;
  part: string;
  credit: string;
  partial: string;
  pending: string;
  overdue: string;
  cancelled: string;
  draft: string;
  outstanding: string;
  recordPaymentBtn: string;
  noInvoicesFound: string;
  deleteInvoiceTitle: string;
  deleteInvoiceMessage: string;
  cancelInvoiceTitle: string;
  cancelInvoiceMessage: string;
  invoiceCreated: string;
  invoiceUpdated: string;
  invoiceDeleted: string;
  invoiceCancelled: string;
  creditSaleNote: string;
  duePaymentNote: string;
  exportInvoicePdf: string;
  billTo: string;
  billFrom: string;
  scanFirstHint: string;
  cartEmpty: string;
  cartEmptyHint: string;
  find: string;
  charge: string;
  completeSale: string;
  saleCompleted: string;
  tapForReceipt: string;
  onlyNInStock: string;
  addAtLeastOneItem: string;
  totalCannotBeNegative: string;
  barcodeAlreadyUsed: string;
  invalidBarcode: string;
  taxRateMax: string;
  mustBePositive: string;
  required: string;
  fieldRequired: string;
  optional: string;
  saveProduct: string;
  deleteCannotBeUndone: string;
  organization: string;
  shopSettings: string;
  currency: string;
  status: string;
  businessName: string;
  businessType: string;
  createOrganization: string;
  editOrganization: string;
  saveShop: string;
  shopSaved: string;
  offlineShopsHint: string;
  createShopNeedsConnection: string;
  deleteShopNeedsConnection: string;
  noOrganizationsYet: string;
  createFirstOrganization: string;
  shortcuts: string;
  allProducts: string;
  salesInvoices: string;
  purchaseInvoices: string;
  partiesSuppliers: string;
  unitPrice: string;
  lineTotal: string;
  selectProduct: string;
  camera: string;
  markAsPaid: string;
  searchInvoicesPlaceholder: string;
  chooseInvoiceType: string;
  deleteTransactionTitle: string;
  deleteTransactionMessage: string;
  transactionUpdated: string;
  transactionDeleted: string;
  pdfExported: string;
  customersAndSuppliers: string;
  mergeComplete: string;
  accountTransactions: string;
  members: string;
  editProduct: string;
  newOrganization: string;
  deleteOrganizationTitle: string;
  orgStatusSuspended: string;
  orgStatusArchived: string;
  dueAmountLeft: string;
  costLabel: string;
  adjust: string;
  // ── Validation messages (Zod) ─────────────────────────────────────────────
  phoneLabel: string;
  address: string;
  vRequired: string;
  vTooLong: string;
  vTooShort: string;
  vInvalidNumber: string;
  vNotNegative: string;
  vAtLeast: string;
  vAtMost: string;
  vGreaterThanZero: string;
  vWholeNumber: string;
  vInvalidDate: string;
  vInvalidEmail: string;
  vInvalidPhone: string;
  vBarcodeNoSpaces: string;
  vSelectParty: string;
  vAtLeastOneItem: string;
  vDueBeforeInvoice: string;
  vDiscountMax: string;
  vDiscountExceedsSubtotal: string;
  vSelectAccountForPayment: string;
  vSelectAccountReceiving: string;
  vEnterAmountReceived: string;
  vSelectCustomerForCredit: string;
  vPaymentExceedsOutstanding: string;
  vInvoiceTotalNegative: string;
  // ── Voice / natural-language entry ───────────────────────────────────────
  smartAddPlaceholder: string;
  speakOrType: string;
  listeningTapToStop: string;
  voiceUnavailable: string;
  voicePermissionNeeded: string;
  voiceBanglaMissing: string;
  profit: string;
  loss: string;
  matchedExisting: string;
  willCreateNew: string;
  pricingOrderAssumed: string;
  pickExisting: string;
  addToCart: string;
  addToInvoice: string;
  retrySync: string;
  syncingNow: string;
  syncStarted: string;
  syncFailedKeepWorking: string;
  deviceOfflineKeepWorking: string;
  backendDownKeepWorking: string;
  upToDate: string;
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
  switchAccount: "Switch Account",
  switchAccountHint: "Sign out and log in as a different user on this device",
  switchAccountConfirm:
    "This clears cached data for the current user. You can then sign in with another account. Continue?",
  signOutConfirm: "Sign out of this account on this device?",
  balanceHealthCheck: "Balance Health Check",
  verifyAndFixBalances:
    "Verify and fix account balances from transaction history",
  manageCategories: "Manage Categories",
  addOrEditCategories: "Add or edit income & expense categories",
  collectionSchemes: "Collection Schemes",
  collectionSchemesSubtitle: "Track family contributions — paid vs due",
  collectionScheme: "Collection scheme",
  selectSchemeOptional: "Optional — link to a scheme",
  createScheme: "Create scheme",
  createLabel: "Create",
  archiveLabel: "Archive",
  removeLabel: "Remove",
  schemeName: "Scheme name",
  schemeNamePlaceholder: "e.g. New 500 Taka (4)",
  schemeNameRequired: "Enter a scheme name",
  schemeRateRequired: "Enter a valid rate per member",
  ratePerMember: "Rate per member",
  descriptionOptional: "Description (optional)",
  notesOptional: "Notes (optional)",
  schemeDescriptionPlaceholder: "Optional notes about this collection",
  schemeCreated: "Scheme created",
  schemeCreateFailed: "Could not create scheme",
  editScheme: "Edit scheme",
  schemeUpdated: "Scheme updated",
  schemeUpdateFailed: "Failed to update scheme",
  duplicateScheme: "Duplicate scheme",
  duplicateSchemeName: "New scheme name",
  duplicateSchemeNamePlaceholder: "Copy of the original scheme",
  duplicateSchemeHint:
    "This duplicates the scheme and its families. Payments/paid/due will start fresh for the new scheme.",
  duplicateLabel: "Duplicate",
  schemeDuplicated: "Scheme duplicated",
  schemeDuplicateFailed: "Could not duplicate scheme",
  deleteScheme: "Delete scheme",
  deleteSchemeConfirm: 'Permanently delete "{name}"? This cannot be undone.',
  deleteSchemeHasFamilies: "Cannot delete a scheme that has enrolled families. Remove all families first.",
  deleteLabel: "Delete",
  schemeDeleted: "Scheme deleted",
  deleteFailed: "Failed to delete",
  archiveScheme: "Archive scheme",
  archiveSchemeConfirm: 'Archive "{name}"? The roster will be hidden.',
  schemeArchived: "Scheme archived",
  schemeArchiveFailed: "Could not archive scheme",
  noSchemesYet: "No schemes yet",
  noSchemesYetHint: "Create a scheme like 500tk to track family payments and dues.",
  familiesCount: "{count} families enrolled",
  families: "Families",
  statusPaid: "Paid",
  statusPartial: "Partial",
  statusDue: "Due",
  expected: "Expected",
  searchFamilies: "Search families…",
  noFamiliesInScheme: "No families enrolled",
  noFamiliesInSchemeHint: "Tap + to enroll a family with member count.",
  enrollFamily: "Enroll family",
  enrollFamilyHint: "Select or add a family to this scheme",
  family: "Family",
  selectFamily: "Select family",
  selectFamilyRequired: "Select a family to enroll",
  memberCount: "Number of members",
  memberCountRequired: "Member count must be at least 1",
  sortOrder: "Sort no.",
  sortOrderHint: "Village order (1, 2, 3…) — list walks from one end to the other",
  sortOrderRequired: "Sort number must be at least 1",
  membersLabel: "Members",
  enroll: "Enroll",
  familyEnrolled: "Family enrolled",
  enrollFailed: "Could not enroll family",
  partyAdded: "Family added",
  recordPayment: "Record payment",
  paymentRecorded: "Payment recorded",
  paymentFailed: "Could not record payment",
  amountRequired: "Enter a valid amount",
  removeFromScheme: "Remove from scheme",
  removeFromSchemeConfirm:
    'Remove "{name}" from this scheme? This cannot be undone.',
  memberRemoved: "Removed from scheme",
  cannotRemoveFamilyWithPayments:
    "Cannot delete — this family already has linked payments/transactions.",
  editFamily: "Edit family",
  deleteFamily: "Delete family",
  updateMemberCount: "Update member count",
  updateMemberCountHint: "Expected amount = members × rate",
  memberUpdated: "Member updated",
  memberUpdateFailed: "Could not update member",
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
  noteLabel: "Note",
  schemeLabel: "Scheme",
  balanceAfterLabel: "Balance after",
  dueDateLabel: "Due date",
  transferIn: "Transfer in",
  transferOut: "Transfer out",
  pay: "Pay",
  returnLoan: "Return",
  returnAmount: "Return Amount",
  recordFullReturn: "Record Full Return",
  recordPartialReturn: "Record Partial Return",
  noteOptional: "Note (Optional)",
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
  selectOrAddVendors: "Select or add vendors",
  selectOrAddCounterparties: "Select or add counterparties",
  bulkTransactions: "Bulk transactions",
  bulkTransactionsHintOn:
    "Tag multiple vendors or counterparties (not both sides)",
  bulkTransactionsHintOff: "Same amount for several people at once",
  bulkModeConflict: "Bulk selection conflict",
  bulkModeConflictHint:
    "Use multiple vendors with one counterparty, or one vendor with multiple counterparties",
  bulkSamePartyBothSides: "Invalid selection",
  bulkSamePartyBothSidesHint:
    "The same person cannot be both vendor and counterparty",
  bulkCollapsedToSingle: "Switched to single",
  bulkCollapsedToSingleHint:
    "Kept the first selection on each side. You can change them anytime.",
  bulkKeptSingleCounterparty: "Counterparty kept to one",
  bulkKeptSingleCounterpartyHint:
    "Multiple vendors require a single counterparty",
  bulkKeptSingleVendor: "Vendor kept to one",
  bulkKeptSingleVendorHint:
    "Multiple counterparties require a single vendor",
  bulkVendorSingleOnly: "Only one vendor allowed",
  bulkVendorSingleOnlyHint:
    "Clear extra counterparties to add more vendors",
  bulkCounterpartySingleOnly: "Only one counterparty allowed",
  bulkCounterpartySingleOnlyHint:
    "Clear extra vendors to add more counterparties",
  saveBulkTransactions: "Save {count} Transactions",
  failedToAddParty: "Could not add party",
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

  // ── Shop / POS / Products / Invoices ──────────────────────────────────────
  shop: "Shop",
  shopDashboard: "Shop",
  newSale: "New Sale",
  saleInvoice: "Sale Invoice",
  newPurchase: "New Purchase",
  addProduct: "Add Product",
  todaysSales: "Today's Sales",
  todaysPurchases: "Today's Purchases",
  inventory: "Inventory",
  totalProducts: "Products",
  lowStock: "Low Stock",
  stockValue: "Stock Value",
  outOfStock: "Out of stock",
  inStock: "In Stock",
  noTracking: "No tracking",
  products: "Products",
  productName: "Product Name",
  productNamePlaceholder: "e.g. Basmati Rice 5kg",
  brand: "Brand",
  brandOptional: "Brand (optional)",
  brandPlaceholder: "e.g. Lux, Pran, Fresh",
  suggestBrands: "Suggested brands",
  suggestProducts: "Suggestions",
  sku: "SKU",
  skuAutoHint: "SKU (auto-generated if blank)",
  barcode: "Barcode",
  barcodeOptional: "Barcode (optional)",
  barcodePlaceholder: "Scan or enter manually",
  scanBarcode: "Scan Barcode",
  scanProductBarcode: "Scan Product Barcode",
  scanItemBarcode: "Scan Item Barcode",
  scanItem: "Scan Item",
  barcodeDetected: "Barcode detected!",
  pointCameraAtBarcode: "Point camera at a barcode",
  cameraPermissionRequired: "Camera permission is required",
  grantPermission: "Grant Permission",
  description: "Description",
  unit: "Unit",
  pricing: "Pricing",
  purchasePrice: "Purchase Price",
  salePrice: "Sale Price",
  additionalCost: "Additional Cost (landed: freight, duty…)",
  additionalCostHint: "Freight, duty and other landed costs",
  costPrice: "Cost Price",
  taxRate: "Tax Rate (%)",
  profitMargin: "Profit Margin",
  openingStock: "Opening Stock",
  lowStockAlert: "Low Stock Alert",
  trackInventory: "Track Inventory",
  trackInventoryHint: "Automatically update stock on invoices",
  active: "Active",
  inactive: "Inactive",
  details: "Details",
  stockHistory: "Stock History",
  currentStock: "Current stock",
  adjustStock: "Adjust Stock",
  addStock: "Add Stock",
  removeStock: "Remove Stock",
  quantity: "Quantity",
  quantityPlaceholder: "Enter quantity",
  unitCostOptional: "Unit Cost (optional)",
  unitCostPlaceholder: "Defaults to cost price",
  adjustmentNotesPlaceholder: "Reason for adjustment",
  confirmAdjustment: "Confirm Adjustment",
  stockAdjustedSuccess: "Stock adjusted successfully",
  insufficientStock: "Insufficient stock for this movement",
  noStockMovements: "No stock movements yet",
  adjustmentIn: "adjustment in",
  adjustmentOut: "adjustment out",
  purchase: "Purchase",
  sale: "Sale",
  purchaseReturn: "Purchase return",
  saleReturn: "Sale return",
  openingStockMovement: "Opening stock",
  noProductsFound: "No Products Found",
  noProductsLowStock: "No products are low on stock.",
  tapToAddFirstProduct: "Tap + to add your first product.",
  searchProductsPlaceholder: "Search name, SKU, barcode…",
  productCreated: "Product created successfully",
  productUpdated: "Product updated successfully",
  productDeleted: "Product deleted successfully",
  deleteProductTitle: "Delete Product",
  deleteProductMessage: 'Delete "{name}"? This cannot be undone.',
  notInCatalog: "Not in catalog — save as new product",
  createProductInline: "Create & Add to Invoice",
  newProduct: "New Product",
  noBarcode: "No barcode",
  restockRequired: "Only {n} in stock — the sale will be rejected if it exceeds stock.",
  invoice: "Invoice",
  invoiceNumber: "Invoice #",
  invoiceDate: "Invoice date",
  dueDate: "Due date",
  reference: "Reference",
  referenceOptional: "Reference (Optional)",
  terms: "Terms",
  internalNotes: "Internal notes",
  customer: "Customer",
  supplier: "Supplier",
  selectCustomer: "Select Customer",
  selectSupplier: "Select Supplier",
  searchCustomersPlaceholder: "Search customers...",
  searchSuppliersPlaceholder: "Search suppliers...",
  walkInCustomer: "Walk-in customer",
  lineItems: "Line Items",
  addItem: "Add Item",
  customerRequired: "Please select a party",
  discountOptional: "Discount (Optional)",
  discount: "Discount",
  discountType: "Discount type",
  shippingCharge: "Shipping charge",
  adjustment: "Adjustment",
  adjustmentDescription: "Adjustment description",
  invoiceDetails: "Invoice Details",
  subTotal: "Subtotal",
  grandTotal: "Grand Total",
  amountPaid: "Paid",
  balanceDue: "Due",
  amountReceived: "Amount received",
  paymentMethod: "Payment Method",
  depositToAccount: "Deposit to Account",
  selectAccountPlaceholder: "Select account...",
  selectAccountForPayment: "Select the account for this payment",
  cash: "Cash",
  bank: "Bank",
  mobileWallet: "MFS",
  cheque: "Cheque",
  other: "Other",
  part: "Part",
  credit: "Credit",
  partial: "Partial",
  pending: "Pending",
  overdue: "Overdue",
  cancelled: "Cancelled",
  draft: "Draft",
  outstanding: "Outstanding",
  recordPaymentBtn: "Record Payment",
  noInvoicesFound: "No invoices found",
  deleteInvoiceTitle: "Delete Invoice",
  deleteInvoiceMessage: "Delete this invoice? This cannot be undone.",
  cancelInvoiceTitle: "Cancel Invoice",
  cancelInvoiceMessage: "Cancel this invoice? Stock will be reversed.",
  invoiceCreated: "Invoice created successfully",
  invoiceUpdated: "Invoice updated successfully",
  invoiceDeleted: "Invoice deleted successfully",
  invoiceCancelled: "Invoice cancelled successfully",
  creditSaleNote:
    "Credit sale: the amount stays due. Record the payment later from the invoice.",
  duePaymentNote:
    "No cash movement. The amount will be tracked as due in the party ledger. You can record payment later.",
  exportInvoicePdf: "Export invoice PDF",
  billTo: "Bill To",
  billFrom: "Bill From",
  scanFirstHint: "Scan a barcode or tap Find to add items",
  cartEmpty: "Cart is empty",
  cartEmptyHint: "Scan a barcode or tap Find to add items",
  find: "Find",
  charge: "Charge",
  completeSale: "Complete sale",
  saleCompleted: "Sale completed",
  tapForReceipt: "tap for receipt",
  onlyNInStock: "Only {n} in stock",
  addAtLeastOneItem: "Add at least one item with a description and price",
  totalCannotBeNegative: "Invoice total cannot be negative",
  barcodeAlreadyUsed: 'Barcode already used by "{name}"',
  invalidBarcode: "Barcode cannot contain spaces",
  taxRateMax: "Tax rate must be at most 100",
  mustBePositive: "{label} must be greater than 0",
  required: "This field is required",
  fieldRequired: "{label} is required",
  optional: "Optional",
  saveProduct: "Save Product",
  deleteCannotBeUndone: "This cannot be undone.",
  organization: "Organization",
  shopSettings: "Organization Settings",
  currency: "Currency",
  status: "Status",
  businessName: "Business Name",
  businessType: "Business Type",
  createOrganization: "Create Organization",
  editOrganization: "Edit Organization",
  saveShop: "Save Changes",
  shopSaved: "Shop saved",
  offlineShopsHint:
    "Offline — showing saved shops. Edits are saved here and sync when you reconnect.",
  createShopNeedsConnection:
    "Creating a shop needs a connection once. Other settings save offline.",
  deleteShopNeedsConnection: "Deleting a shop needs a connection.",
  noOrganizationsYet: "No Organizations Yet",
  createFirstOrganization:
    "Create your first organization to start managing your business with multiple users.",
  shortcuts: "Shortcuts",
  allProducts: "All Products",
  salesInvoices: "Sales Invoices",
  purchaseInvoices: "Purchase Invoices",
  partiesSuppliers: "Parties / Suppliers",
  unitPrice: "Unit Price",
  lineTotal: "Line Total",
  selectProduct: "Select Product",
  camera: "Camera",
  markAsPaid: "Mark as Paid",
  searchInvoicesPlaceholder: "Search invoice # or party…",
  chooseInvoiceType: "Choose the type of invoice to create",
  deleteTransactionTitle: "Delete Transaction?",
  deleteTransactionMessage:
    "This will remove the transaction from your ledger.",
  transactionUpdated: "Transaction updated",
  transactionDeleted: "Transaction deleted",
  pdfExported: "PDF exported successfully",
  customersAndSuppliers: "Customers & Suppliers",
  mergeComplete: "Merge complete",
  accountTransactions: "Account transactions",
  members: "Members",
  editProduct: "Edit Product",
  newOrganization: "New Organization",
  deleteOrganizationTitle: "Delete Organization",
  orgStatusSuspended: "Suspended",
  orgStatusArchived: "Archived",
  // Composed so Bangla reads naturally instead of "বাকি · 500 বাকি".
  dueAmountLeft: "{n} left",
  costLabel: "Cost",
  adjust: "Adjust",
  phoneLabel: "Phone",
  address: "Address",
  vRequired: "{label} is required",
  vTooLong: "{label} must be under {max} characters",
  vTooShort: "{label} must be at least {n} characters",
  vInvalidNumber: "{label} must be a valid number",
  vNotNegative: "{label} cannot be negative",
  vAtLeast: "{label} must be at least {min}",
  vAtMost: "{label} must be at most {max}",
  vGreaterThanZero: "{label} must be greater than 0",
  vWholeNumber: "{label} must be a whole number",
  vInvalidDate: "{label} must be a valid date",
  vInvalidEmail: "Enter a valid email address",
  vInvalidPhone: "Enter a valid phone number",
  vBarcodeNoSpaces: "Barcode cannot contain spaces",
  vSelectParty: "Please select a party",
  vAtLeastOneItem: "Add at least one item with a description and price",
  vDueBeforeInvoice: "Due date cannot be before the invoice date",
  vDiscountMax: "Discount % cannot exceed 100",
  vDiscountExceedsSubtotal: "Discount cannot exceed the line subtotal",
  vSelectAccountForPayment: "Select the account for this payment",
  vSelectAccountReceiving: "Select the account that receives the money",
  vEnterAmountReceived: "Enter the amount received",
  vSelectCustomerForCredit: "Select a customer for a credit sale",
  vPaymentExceedsOutstanding: "Amount cannot exceed the outstanding {n}",
  vInvoiceTotalNegative: "Invoice total cannot be negative",
  // ── Voice / natural-language entry ───────────────────────────────────────
  smartAddPlaceholder: 'Say or type it: "সাবান ২টা ৪৫ টাকা"',
  speakOrType: "Speak or type",
  listeningTapToStop: "Listening… tap the mic to stop",
  voiceUnavailable: "Voice is not available on this device — please type.",
  voicePermissionNeeded: "Microphone permission is required.",
  voiceBanglaMissing:
    "Bangla voice is not installed — listening in English. Install: Settings → General → Keyboard → Keyboards → Add Keyboard → বাংলা. Then enable Dictation and add বাংলা.",
  profit: "profit",
  loss: "loss",
  matchedExisting: "existing",
  willCreateNew: "new",
  pricingOrderAssumed: "First price read as cost, second as selling price",
  pickExisting: "Or pick an existing product",
  addToCart: "Add to cart",
  addToInvoice: "Add to invoice",
  retrySync: "Sync",
  syncingNow: "Syncing…",
  syncStarted: "Syncing now…",
  syncFailedKeepWorking:
    "Sync failed. Please wait — your work is saved and will sync automatically later.",
  deviceOfflineKeepWorking:
    "Your device is offline. Keep working — sync will happen automatically later.",
  backendDownKeepWorking:
    "Backend is down or unreachable. Keep working — sync will happen automatically later.",
  upToDate: "Everything is synced",
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
  switchAccount: "অ্যাকাউন্ট পরিবর্তন",
  switchAccountHint:
    "সাইন আউট করে এই ডিভাইসে অন্য ইউজার হিসেবে লগইন করুন",
  switchAccountConfirm:
    "বর্তমান ইউজারের ক্যাশ ডেটা মুছে যাবে। এরপর অন্য অ্যাকাউন্টে সাইন ইন করতে পারবেন। চালিয়ে যাবেন?",
  signOutConfirm: "এই ডিভাইস থেকে সাইন আউট করবেন?",
  balanceHealthCheck: "ব্যালেন্স হেলথ চেক",
  verifyAndFixBalances:
    "লেনদেন ইতিহাস থেকে অ্যাকাউন্ট ব্যালেন্স যাচাই ও সংশোধন করুন",
  manageCategories: "ক্যাটাগরি পরিচালনা",
  addOrEditCategories: "আয় ও ব্যয়ের ক্যাটাগরি যোগ বা সম্পাদনা করুন",
  collectionSchemes: "কালেকশন স্কিম",
  collectionSchemesSubtitle: "পরিবারভিত্তিক জমা — পরিশোধ ও বকেয়া",
  collectionScheme: "কালেকশন স্কিম",
  selectSchemeOptional: "ঐচ্ছিক — স্কিমের সাথে লিংক করুন",
  createScheme: "স্কিম তৈরি করুন",
  createLabel: "তৈরি",
  archiveLabel: "আর্কাইভ",
  removeLabel: "সরান",
  schemeName: "স্কিমের নাম",
  schemeNamePlaceholder: "যেমন: নতুন ৫০০ টাকা (৪)",
  schemeNameRequired: "স্কিমের নাম লিখুন",
  schemeRateRequired: "সদস্যপ্রতি সঠিক রেট লিখুন",
  ratePerMember: "সদস্যপ্রতি রেট",
  descriptionOptional: "বিবরণ (ঐচ্ছিক)",
  notesOptional: "নোট (ঐচ্ছিক)",
  schemeDescriptionPlaceholder: "এই কালেকশন সম্পর্কে ঐচ্ছিক নোট",
  schemeCreated: "স্কিম তৈরি হয়েছে",
  schemeCreateFailed: "স্কিম তৈরি করা যায়নি",
  editScheme: "স্কিম সম্পাদনা",
  schemeUpdated: "স্কিম আপডেট হয়েছে",
  schemeUpdateFailed: "স্কিম আপডেট ব্যর্থ",
  duplicateScheme: "স্কিম ডুপ্লিকেট করুন",
  duplicateSchemeName: "নতুন স্কিমের নাম",
  duplicateSchemeNamePlaceholder: "মূল স্কিমের কপি",
  duplicateSchemeHint:
    "এই ডুপ্লিকেশনে স্কিম ও তার পরিবারগুলো কপি হয়। নতুন স্কিমের জন্য পরিশোধ/বকেয়া শুরু থেকে গণনা হবে।",
  duplicateLabel: "ডুপ্লিকেট",
  schemeDuplicated: "স্কিম ডুপ্লিকেট হয়েছে",
  schemeDuplicateFailed: "স্কিম ডুপ্লিকেট করা যায়নি",
  deleteScheme: "স্কিম মুছুন",
  deleteSchemeConfirm: '"{name}" স্থায়ীভাবে মুছে ফেলবেন? এটি পূর্বাবস্থায় ফেরানো যাবে না।',
  deleteSchemeHasFamilies: "পরিবার নথিভুক্ত থাকা স্কিম মুছতে পারবেন না। আগে সব পরিবার সরান।",
  deleteLabel: "মুছুন",
  schemeDeleted: "স্কিম মুছে ফেলা হয়েছে",
  deleteFailed: "মুছতে ব্যর্থ",
  archiveScheme: "স্কিম আর্কাইভ",
  archiveSchemeConfirm: '"{name}" আর্কাইভ করবেন? রোস্টার লুকানো হবে।',
  schemeArchived: "স্কিম আর্কাইভ হয়েছে",
  schemeArchiveFailed: "স্কিম আর্কাইভ করা যায়নি",
  noSchemesYet: "এখনো কোনো স্কিম নেই",
  noSchemesYetHint:
    "৫০০টাকার মতো স্কিম তৈরি করে পরিবারের জমা ও বকেয়া ট্র্যাক করুন।",
  familiesCount: "{count} পরিবার তালিকাভুক্ত",
  families: "পরিবার",
  statusPaid: "পরিশোধিত",
  statusPartial: "আংশিক",
  statusDue: "বকেয়া",
  expected: "প্রত্যাশিত",
  searchFamilies: "পরিবার খুঁজুন…",
  noFamiliesInScheme: "কোনো পরিবার নেই",
  noFamiliesInSchemeHint: "+ চাপুন — সদস্য সংখ্যাসহ পরিবার যোগ করুন।",
  enrollFamily: "পরিবার যোগ করুন",
  enrollFamilyHint: "এই স্কিমে পরিবার নির্বাচন বা যোগ করুন",
  family: "পরিবার",
  selectFamily: "পরিবার নির্বাচন",
  selectFamilyRequired: "যোগ করার জন্য পরিবার নির্বাচন করুন",
  memberCount: "লোকসংখ্যা",
  memberCountRequired: "লোকসংখ্যা কমপক্ষে ১ হতে হবে",
  sortOrder: "ক্রমিক নং",
  sortOrderHint: "গ্রামের ক্রম (১, ২, ৩…) — এক প্রান্ত থেকে অন্য প্রান্তে সাজানো",
  sortOrderRequired: "ক্রমিক নম্বর কমপক্ষে ১ হতে হবে",
  membersLabel: "সদস্য",
  enroll: "যোগ করুন",
  familyEnrolled: "পরিবার যোগ হয়েছে",
  enrollFailed: "পরিবার যোগ করা যায়নি",
  partyAdded: "পরিবার যোগ হয়েছে",
  recordPayment: "জমা রেকর্ড",
  paymentRecorded: "জমা রেকর্ড হয়েছে",
  paymentFailed: "জমা রেকর্ড করা যায়নি",
  amountRequired: "সঠিক পরিমাণ লিখুন",
  removeFromScheme: "স্কিম থেকে সরান",
  removeFromSchemeConfirm:
    '"{name}" এই স্কিম থেকে সরাবেন? এটি পূর্বাবস্থায় ফেরানো যাবে না।',
  memberRemoved: "স্কিম থেকে সরানো হয়েছে",
  cannotRemoveFamilyWithPayments:
    "মুছা যাবে না — এই পরিবারের সাথে জমা/লেনদেন যুক্ত আছে।",
  editFamily: "পরিবার এডিট",
  deleteFamily: "পরিবার মুছুন",
  updateMemberCount: "লোকসংখ্যা আপডেট",
  updateMemberCountHint: "প্রত্যাশিত = সদস্য × রেট",
  memberUpdated: "আপডেট হয়েছে",
  memberUpdateFailed: "আপডেট করা যায়নি",
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
  noteLabel: "নোট",
  schemeLabel: "স্কিম",
  balanceAfterLabel: "পরবর্তী ব্যালেন্স",
  dueDateLabel: "বকেয়ার তারিখ",
  transferIn: "স্থানান্তর গ্রহণ",
  transferOut: "স্থানান্তর প্রদান",
  pay: "পরিশোধ করুন",
  returnLoan: "ফেরত দিন",
  returnAmount: "ফেরতের পরিমাণ",
  recordFullReturn: "সম্পূর্ণ ফেরত রেকর্ড করুন",
  recordPartialReturn: "আংশিক ফেরত রেকর্ড করুন",
  noteOptional: "নোট (ঐচ্ছিক)",
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
  selectOrAddVendors: "বিক্রেতা নির্বাচন বা যোগ করুন",
  selectOrAddCounterparties: "কাউন্টারপার্টি নির্বাচন বা যোগ করুন",
  bulkTransactions: "বাল্ক লেনদেন",
  bulkTransactionsHintOn:
    "একাধিক বিক্রেতা বা কাউন্টারপার্টি ট্যাগ করুন (দুই দিকে নয়)",
  bulkTransactionsHintOff: "একই পরিমাণে একসাথে একাধিক ব্যক্তির জন্য",
  bulkModeConflict: "বাল্ক নির্বাচনে দ্বন্দ্ব",
  bulkModeConflictHint:
    "একাধিক বিক্রেতার সাথে একজন কাউন্টারপার্টি, অথবা একজন বিক্রেতার সাথে একাধিক কাউন্টারপার্টি ব্যবহার করুন",
  bulkSamePartyBothSides: "অবৈধ নির্বাচন",
  bulkSamePartyBothSidesHint:
    "একই ব্যক্তি একসাথে বিক্রেতা ও কাউন্টারপার্টি হতে পারে না",
  bulkCollapsedToSingle: "সিঙ্গেল মোডে স্যুইচ হয়েছে",
  bulkCollapsedToSingleHint:
    "প্রতি পাশে প্রথম নির্বাচন রাখা হয়েছে। চাইলে পরিবর্তন করতে পারবেন।",
  bulkKeptSingleCounterparty: "কাউন্টারপার্টি একটিতে রাখা হয়েছে",
  bulkKeptSingleCounterpartyHint:
    "একাধিক বিক্রেতার জন্য একজন কাউন্টারপার্টি লাগবে",
  bulkKeptSingleVendor: "বিক্রেতা একটিতে রাখা হয়েছে",
  bulkKeptSingleVendorHint:
    "একাধিক কাউন্টারপার্টির জন্য একজন বিক্রেতা লাগবে",
  bulkVendorSingleOnly: "শুধু একজন বিক্রেতা যোগ করা যাবে",
  bulkVendorSingleOnlyHint:
    "আরও বিক্রেতা যোগ করতে অতিরিক্ত কাউন্টারপার্টি সরান",
  bulkCounterpartySingleOnly: "শুধু একজন কাউন্টারপার্টি যোগ করা যাবে",
  bulkCounterpartySingleOnlyHint:
    "আরও কাউন্টারপার্টি যোগ করতে অতিরিক্ত বিক্রেতা সরান",
  saveBulkTransactions: "{count}টি লেনদেন সংরক্ষণ করুন",
  failedToAddParty: "পার্টি যোগ করা যায়নি",
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

  // ── Shop / POS / Products / Invoices ──────────────────────────────────────
  shop: "শপ",
  shopDashboard: "শপ",
  newSale: "নতুন বিক্রয়",
  saleInvoice: "বিক্রয় ইনভয়েস",
  newPurchase: "নতুন ক্রয়",
  addProduct: "পণ্য যোগ করুন",
  todaysSales: "আজকের বিক্রয়",
  todaysPurchases: "আজকের ক্রয়",
  inventory: "মজুদ",
  totalProducts: "পণ্য",
  lowStock: "কম মজুদ",
  stockValue: "মজুদের মূল্য",
  outOfStock: "স্টক নেই",
  inStock: "স্টকে আছে",
  noTracking: "ট্র্যাকিং নেই",
  products: "পণ্যসমূহ",
  productName: "পণ্যের নাম",
  productNamePlaceholder: "যেমন: বাসমতি চাল ৫ কেজি",
  brand: "ব্র্যান্ড",
  brandOptional: "ব্র্যান্ড (ঐচ্ছিক)",
  brandPlaceholder: "যেমন: লাক্স, প্রাণ, ফ্রেশ",
  suggestBrands: "প্রস্তাবিত ব্র্যান্ড",
  suggestProducts: "সাজেশন",
  sku: "এসকেইউ",
  skuAutoHint: "এসকেইউ (খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে)",
  barcode: "বারকোড",
  barcodeOptional: "বারকোড (ঐচ্ছিক)",
  barcodePlaceholder: "স্ক্যান করুন বা হাতে লিখুন",
  scanBarcode: "বারকোড স্ক্যান করুন",
  scanProductBarcode: "পণ্যের বারকোড স্ক্যান করুন",
  scanItemBarcode: "পণ্যের বারকোড স্ক্যান করুন",
  scanItem: "পণ্য স্ক্যান করুন",
  barcodeDetected: "বারকোড পাওয়া গেছে!",
  pointCameraAtBarcode: "ক্যামেরা বারকোডের দিকে ধরুন",
  cameraPermissionRequired: "ক্যামেরার অনুমতি প্রয়োজন",
  grantPermission: "অনুমতি দিন",
  description: "বিবরণ",
  unit: "একক",
  pricing: "মূল্য নির্ধারণ",
  purchasePrice: "ক্রয় মূল্য",
  salePrice: "বিক্রয় মূল্য",
  additionalCost: "অতিরিক্ত খরচ (পরিবহন, শুল্ক…)",
  additionalCostHint: "পরিবহন, শুল্ক ও অন্যান্য খরচ",
  costPrice: "ক্রয় খরচ",
  taxRate: "কর হার (%)",
  profitMargin: "মুনাফার হার",
  openingStock: "প্রারম্ভিক মজুদ",
  lowStockAlert: "কম মজুদের সতর্কতা",
  trackInventory: "মজুদ ট্র্যাক করুন",
  trackInventoryHint: "ইনভয়েসে স্বয়ংক্রিয়ভাবে মজুদ হালনাগাদ হবে",
  active: "সক্রিয়",
  inactive: "নিষ্ক্রিয়",
  details: "বিবরণ",
  stockHistory: "মজুদের ইতিহাস",
  currentStock: "বর্তমান মজুদ",
  adjustStock: "মজুদ সমন্বয়",
  addStock: "মজুদ যোগ",
  removeStock: "মজুদ কমাও",
  quantity: "পরিমাণ",
  quantityPlaceholder: "পরিমাণ লিখুন",
  unitCostOptional: "একক খরচ (ঐচ্ছিক)",
  unitCostPlaceholder: "ডিফল্ট: ক্রয় খরচ",
  adjustmentNotesPlaceholder: "সমন্বয়ের কারণ",
  confirmAdjustment: "সমন্বয় নিশ্চিত করুন",
  stockAdjustedSuccess: "মজুদ সফলভাবে সমন্বয় হয়েছে",
  insufficientStock: "এই পরিবর্তনের জন্য পর্যাপ্ত মজুদ নেই",
  noStockMovements: "এখনো কোনো মজুদ পরিবর্তন নেই",
  adjustmentIn: "মজুদ বৃদ্ধি",
  adjustmentOut: "মজুদ হ্রাস",
  purchase: "ক্রয়",
  sale: "বিক্রয়",
  purchaseReturn: "ক্রয় ফেরত",
  saleReturn: "বিক্রয় ফেরত",
  openingStockMovement: "প্রারম্ভিক মজুদ",
  noProductsFound: "কোনো পণ্য পাওয়া যায়নি",
  noProductsLowStock: "কোনো পণ্যের মজুদ কম নয়।",
  tapToAddFirstProduct: "প্রথম পণ্য যোগ করতে + চাপুন।",
  searchProductsPlaceholder: "নাম, এসকেইউ, বারকোড দিয়ে খুঁজুন…",
  productCreated: "পণ্য সফলভাবে তৈরি হয়েছে",
  productUpdated: "পণ্য সফলভাবে হালনাগাদ হয়েছে",
  productDeleted: "পণ্য সফলভাবে মুছে ফেলা হয়েছে",
  deleteProductTitle: "পণ্য মুছুন",
  deleteProductMessage: '"{name}" মুছে ফেলবেন? এটি ফেরানো যাবে না।',
  notInCatalog: "ক্যাটালগে নেই — নতুন পণ্য হিসেবে সংরক্ষণ করুন",
  createProductInline: "তৈরি করুন ও ইনভয়েসে যোগ করুন",
  newProduct: "নতুন পণ্য",
  noBarcode: "বারকোড নেই",
  restockRequired: "মজুদ মাত্র {n}টি — এর বেশি বিক্রয় করা যাবে না।",
  invoice: "ইনভয়েস",
  invoiceNumber: "ইনভয়েস নম্বর",
  invoiceDate: "ইনভয়েসের তারিখ",
  dueDate: "পরিশোধের তারিখ",
  reference: "রেফারেন্স",
  referenceOptional: "রেফারেন্স (ঐচ্ছিক)",
  terms: "শর্তাবলী",
  internalNotes: "অভ্যন্তরীণ নোট",
  customer: "ক্রেতা",
  supplier: "সরবরাহকারী",
  selectCustomer: "ক্রেতা নির্বাচন করুন",
  selectSupplier: "সরবরাহকারী নির্বাচন করুন",
  searchCustomersPlaceholder: "ক্রেতা খুঁজুন...",
  searchSuppliersPlaceholder: "সরবরাহকারী খুঁজুন...",
  walkInCustomer: "সাধারণ ক্রেতা",
  lineItems: "আইটেম তালিকা",
  addItem: "আইটেম যোগ করুন",
  customerRequired: "একটি পক্ষ নির্বাচন করুন",
  discountOptional: "ছাড় (ঐচ্ছিক)",
  discount: "ছাড়",
  discountType: "ছাড়ের ধরন",
  shippingCharge: "পরিবহন খরচ",
  adjustment: "সমন্বয়",
  adjustmentDescription: "সমন্বয়ের বিবরণ",
  invoiceDetails: "ইনভয়েসের বিবরণ",
  subTotal: "উপমোট",
  grandTotal: "সর্বমোট",
  amountPaid: "পরিশোধিত",
  balanceDue: "বাকি",
  amountReceived: "প্রাপ্ত পরিমাণ",
  paymentMethod: "পরিশোধের মাধ্যম",
  depositToAccount: "যে অ্যাকাউন্টে জমা হবে",
  selectAccountPlaceholder: "অ্যাকাউন্ট নির্বাচন করুন...",
  selectAccountForPayment: "এই পরিশোধের জন্য অ্যাকাউন্ট নির্বাচন করুন",
  cash: "নগদ",
  bank: "ব্যাংক",
  mobileWallet: "মোবাইল ব্যাংকিং",
  cheque: "চেক",
  other: "অন্যান্য",
  part: "আংশিক",
  credit: "বাকি",
  partial: "আংশিক",
  pending: "অপেক্ষমাণ",
  overdue: "সময়োত্তীর্ণ",
  cancelled: "বাতিল",
  draft: "খসড়া",
  outstanding: "বাকি আছে",
  recordPaymentBtn: "পরিশোধ রেকর্ড করুন",
  noInvoicesFound: "কোনো ইনভয়েস পাওয়া যায়নি",
  deleteInvoiceTitle: "ইনভয়েস মুছুন",
  deleteInvoiceMessage: "ইনভয়েসটি মুছে ফেলবেন? এটি ফেরানো যাবে না।",
  cancelInvoiceTitle: "ইনভয়েস বাতিল",
  cancelInvoiceMessage: "ইনভয়েস বাতিল করবেন? মজুদ ফিরিয়ে নেওয়া হবে।",
  invoiceCreated: "ইনভয়েস সফলভাবে তৈরি হয়েছে",
  invoiceUpdated: "ইনভয়েস সফলভাবে হালনাগাদ হয়েছে",
  invoiceDeleted: "ইনভয়েস সফলভাবে মুছে ফেলা হয়েছে",
  invoiceCancelled: "ইনভয়েস সফলভাবে বাতিল হয়েছে",
  creditSaleNote:
    "বাকি বিক্রয়: টাকা বাকি থাকবে। পরে ইনভয়েস থেকে পরিশোধ রেকর্ড করুন।",
  duePaymentNote:
    "কোনো নগদ লেনদেন হবে না। টাকা পক্ষের খাতায় বাকি হিসেবে থাকবে। পরে পরিশোধ রেকর্ড করতে পারবেন।",
  exportInvoicePdf: "ইনভয়েস পিডিএফ এক্সপোর্ট",
  billTo: "যার কাছে বিল",
  billFrom: "যার কাছ থেকে বিল",
  scanFirstHint: "বারকোড স্ক্যান করুন বা খুঁজুন চেপে পণ্য যোগ করুন",
  cartEmpty: "কার্ট খালি",
  cartEmptyHint: "বারকোড স্ক্যান করুন বা খুঁজুন চেপে পণ্য যোগ করুন",
  find: "খুঁজুন",
  charge: "নিন",
  completeSale: "বিক্রয় সম্পন্ন করুন",
  saleCompleted: "বিক্রয় সম্পন্ন",
  tapForReceipt: "রসিদ দেখতে চাপুন",
  onlyNInStock: "মজুদ মাত্র {n}টি",
  addAtLeastOneItem: "বিবরণ ও মূল্যসহ অন্তত একটি আইটেম যোগ করুন",
  totalCannotBeNegative: "ইনভয়েসের মোট ঋণাত্মক হতে পারে না",
  barcodeAlreadyUsed: 'বারকোড "{name}" এর সাথে ব্যবহৃত হয়েছে',
  invalidBarcode: "বারকোডে স্পেস থাকতে পারে না",
  taxRateMax: "কর হার সর্বোচ্চ ১০০ হতে পারে",
  mustBePositive: "{label} ০ এর বেশি হতে হবে",
  required: "এই ঘরটি পূরণ করা আবশ্যক",
  fieldRequired: "{label} আবশ্যক",
  optional: "ঐচ্ছিক",
  saveProduct: "পণ্য সংরক্ষণ করুন",
  deleteCannotBeUndone: "এটি ফেরানো যাবে না।",
  organization: "প্রতিষ্ঠান",
  shopSettings: "প্রতিষ্ঠানের সেটিংস",
  currency: "মুদ্রা",
  status: "অবস্থা",
  businessName: "ব্যবসার নাম",
  businessType: "ব্যবসার ধরন",
  createOrganization: "প্রতিষ্ঠান তৈরি করুন",
  editOrganization: "প্রতিষ্ঠান সম্পাদনা",
  saveShop: "পরিবর্তন সংরক্ষণ করুন",
  shopSaved: "শপ সংরক্ষিত হয়েছে",
  offlineShopsHint:
    "অফলাইন — সংরক্ষিত শপ দেখানো হচ্ছে। পরিবর্তন এখানে সংরক্ষিত হবে এবং ইন্টারনেট এলে সিঙ্ক হবে।",
  createShopNeedsConnection:
    "নতুন শপ তৈরি করতে একবার ইন্টারনেট প্রয়োজন। বাকি সেটিংস অফলাইনে সংরক্ষিত হয়।",
  deleteShopNeedsConnection: "শপ মুছতে ইন্টারনেট প্রয়োজন।",
  noOrganizationsYet: "এখনো কোনো প্রতিষ্ঠান নেই",
  createFirstOrganization:
    "একাধিক ব্যবহারকারীর সাথে ব্যবসা পরিচালনা করতে প্রথম প্রতিষ্ঠান তৈরি করুন।",
  shortcuts: "শর্টকাট",
  allProducts: "সব পণ্য",
  salesInvoices: "বিক্রয় ইনভয়েস",
  purchaseInvoices: "ক্রয় ইনভয়েস",
  partiesSuppliers: "পক্ষ / সরবরাহকারী",
  unitPrice: "একক মূল্য",
  lineTotal: "সারির মোট",
  selectProduct: "পণ্য নির্বাচন করুন",
  camera: "ক্যামেরা",
  markAsPaid: "পরিশোধিত হিসেবে চিহ্নিত করুন",
  searchInvoicesPlaceholder: "ইনভয়েস নম্বর বা পক্ষ দিয়ে খুঁজুন…",
  chooseInvoiceType: "যে ধরনের ইনভয়েস তৈরি করবেন তা নির্বাচন করুন",
  deleteTransactionTitle: "লেনদেন মুছবেন?",
  deleteTransactionMessage: "এটি আপনার খাতা থেকে লেনদেনটি মুছে ফেলবে।",
  transactionUpdated: "লেনদেন হালনাগাদ হয়েছে",
  transactionDeleted: "লেনদেন মুছে ফেলা হয়েছে",
  pdfExported: "পিডিএফ সফলভাবে এক্সপোর্ট হয়েছে",
  customersAndSuppliers: "ক্রেতা ও সরবরাহকারী",
  mergeComplete: "একত্রীকরণ সম্পন্ন",
  accountTransactions: "অ্যাকাউন্টের লেনদেন",
  members: "সদস্য",
  editProduct: "পণ্য সম্পাদনা",
  newOrganization: "নতুন প্রতিষ্ঠান",
  deleteOrganizationTitle: "প্রতিষ্ঠান মুছুন",
  orgStatusSuspended: "স্থগিত",
  orgStatusArchived: "সংরক্ষিত",
  dueAmountLeft: "{n} বাকি",
  costLabel: "খরচ",
  adjust: "সমন্বয়",
  phoneLabel: "ফোন",
  address: "ঠিকানা",
  vRequired: "{label} আবশ্যক",
  vTooLong: "{label} {max} অক্ষরের কম হতে হবে",
  vTooShort: "{label} কমপক্ষে {n} অক্ষর হতে হবে",
  vInvalidNumber: "{label} একটি বৈধ সংখ্যা হতে হবে",
  vNotNegative: "{label} ঋণাত্মক হতে পারবে না",
  vAtLeast: "{label} কমপক্ষে {min} হতে হবে",
  vAtMost: "{label} সর্বোচ্চ {max} হতে পারে",
  vGreaterThanZero: "{label} ০ এর বেশি হতে হবে",
  vWholeNumber: "{label} পূর্ণসংখ্যা হতে হবে",
  vInvalidDate: "{label} একটি বৈধ তারিখ হতে হবে",
  vInvalidEmail: "একটি বৈধ ইমেইল ঠিকানা লিখুন",
  vInvalidPhone: "একটি বৈধ ফোন নম্বর লিখুন",
  vBarcodeNoSpaces: "বারকোডে স্পেস থাকতে পারে না",
  vSelectParty: "একটি পক্ষ নির্বাচন করুন",
  vAtLeastOneItem: "বিবরণ ও মূল্যসহ অন্তত একটি আইটেম যোগ করুন",
  vDueBeforeInvoice: "পরিশোধের তারিখ ইনভয়েসের তারিখের আগে হতে পারে না",
  vDiscountMax: "ছাড় ১০০% এর বেশি হতে পারে না",
  vDiscountExceedsSubtotal: "ছাড় সারির মোটের চেয়ে বেশি হতে পারে না",
  vSelectAccountForPayment: "এই পরিশোধের জন্য অ্যাকাউন্ট নির্বাচন করুন",
  vSelectAccountReceiving: "যে অ্যাকাউন্টে টাকা আসবে তা নির্বাচন করুন",
  vEnterAmountReceived: "প্রাপ্ত পরিমাণ লিখুন",
  vSelectCustomerForCredit: "বাকি বিক্রয়ের জন্য একজন ক্রেতা নির্বাচন করুন",
  vPaymentExceedsOutstanding: "পরিমাণ বাকি {n} এর বেশি হতে পারে না",
  vInvoiceTotalNegative: "ইনভয়েসের মোট ঋণাত্মক হতে পারে না",
  // ── Voice / natural-language entry ───────────────────────────────────────
  smartAddPlaceholder: 'বলুন বা লিখুন: "সাবান ২টা ৪৫ টাকা"',
  speakOrType: "বলুন বা লিখুন",
  listeningTapToStop: "শোনা হচ্ছে… থামাতে মাইকে চাপুন",
  voiceUnavailable: "এই ডিভাইসে ভয়েস নেই — টাইপ করে লিখুন।",
  voicePermissionNeeded: "মাইক্রোফোনের অনুমতি প্রয়োজন।",
  voiceBanglaMissing:
    "বাংলা ভয়েস ইনস্টল নেই — ইংরেজিতে শুনবে। ইনস্টল: Settings → General → Keyboard → Keyboards → Add Keyboard → বাংলা। তারপর Dictation চালু করে বাংলা যোগ করুন।",
  profit: "লাভ",
  loss: "ক্ষতি",
  matchedExisting: "আগের পণ্য",
  willCreateNew: "নতুন",
  pricingOrderAssumed: "প্রথম দাম ক্রয়, দ্বিতীয়টি বিক্রয় ধরা হয়েছে",
  pickExisting: "অথবা আগের পণ্য থেকে বেছে নিন",
  addToCart: "কার্টে যোগ করুন",
  addToInvoice: "ইনভয়েসে যোগ করুন",
  retrySync: "সিঙ্ক",
  syncingNow: "সিঙ্ক হচ্ছে…",
  syncStarted: "এখন সিঙ্ক হচ্ছে…",
  syncFailedKeepWorking:
    "সিঙ্ক ব্যর্থ হয়েছে। অপেক্ষা করুন — আপনার কাজ সংরক্ষিত আছে, পরে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।",
  deviceOfflineKeepWorking:
    "আপনার ডিভাইস অফলাইনে আছে। কাজ চালিয়ে যান — পরে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।",
  backendDownKeepWorking:
    "সার্ভার বন্ধ বা পাওয়া যাচ্ছে না। কাজ চালিয়ে যান — পরে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।",
  upToDate: "সবকিছু সিঙ্ক হয়েছে",
};

export const translations: Record<string, AppTranslations> = { en, bn };
export type SupportedLanguage = keyof typeof translations;
