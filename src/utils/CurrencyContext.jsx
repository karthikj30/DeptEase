import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { SUPPORTED_CURRENCIES, getSavedCurrencyCode, saveCurrencyCode, formatCurrencyFromBase, toBaseAmount, fromBaseAmount, getCurrencyConfig } from './currencyConfig';

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [code, setCode] = useState(() => getSavedCurrencyCode());

  useEffect(() => {
    saveCurrencyCode(code);
  }, [code]);

  const value = useMemo(() => {
    const config = getCurrencyConfig(code);
    return {
      code,
      config,
      symbol: config.symbol,
      supported: SUPPORTED_CURRENCIES,
      setCode,
      formatFromBase: formatCurrencyFromBase,
      toBaseAmount,
      fromBaseAmount,
    };
  }, [code]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
