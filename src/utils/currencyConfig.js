// Basic currency configuration and helpers for DebtEase.

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '\u20b9', label: 'INR \\u2013 Indian Rupee', rateToBase: 1 },
  { code: 'USD', symbol: '$', label: 'USD \\u2013 US Dollar', rateToBase: 83 },
  { code: 'EUR', symbol: '\u20ac', label: 'EUR \\u2013 Euro', rateToBase: 90 },
  { code: 'GBP', symbol: '\u00a3', label: 'GBP \\u2013 British Pound', rateToBase: 105 },
  { code: 'AED', symbol: 'د.إ', label: 'AED \\u2013 UAE Dirham', rateToBase: 22.5 },
];

const DEFAULT_CODE = 'INR';

export function getCurrencyConfig(code) {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
}

export function getSavedCurrencyCode() {
  if (typeof window === 'undefined') return DEFAULT_CODE;
  return localStorage.getItem('debtEaseCurrency') || DEFAULT_CODE;
}

export function saveCurrencyCode(code) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('debtEaseCurrency', code);
}

// Convert from displayed currency amount to base (INR) amount.
export function toBaseAmount(displayAmount, code) {
  const cfg = getCurrencyConfig(code || getSavedCurrencyCode());
  const num = Number(displayAmount) || 0;
  // rateToBase: 1 display unit = rateToBase base units
  return num * cfg.rateToBase;
}

// Convert from base (INR) amount to display currency amount.
export function fromBaseAmount(baseAmount, code) {
  const cfg = getCurrencyConfig(code || getSavedCurrencyCode());
  const num = Number(baseAmount) || 0;
  if (!cfg.rateToBase) return num;
  return num / cfg.rateToBase;
}

export function formatCurrencyFromBase(baseAmount, opts = {}) {
  const code = opts.code || getSavedCurrencyCode();
  const cfg = getCurrencyConfig(code);
  const value = fromBaseAmount(baseAmount, code);
  const maximumFractionDigits = opts.maximumFractionDigits ?? 2;
  const minimumFractionDigits = opts.minimumFractionDigits ?? 0;

  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return `${cfg.symbol}${formatted}`;
}
