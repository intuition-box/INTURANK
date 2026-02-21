import React, { createContext, useContext, useState, useCallback } from 'react';

type EmailNotifyContextValue = {
  openEmailNotify: () => void;
  closeEmailNotify: () => void;
  isEmailNotifyOpen: boolean;
};

const EmailNotifyContext = createContext<EmailNotifyContextValue | null>(null);

export function EmailNotifyProvider({ children }: { children: React.ReactNode }) {
  const [isEmailNotifyOpen, setIsEmailNotifyOpen] = useState(false);
  const openEmailNotify = useCallback(() => setIsEmailNotifyOpen(true), []);
  const closeEmailNotify = useCallback(() => setIsEmailNotifyOpen(false), []);
  return (
    <EmailNotifyContext.Provider
      value={{ openEmailNotify, closeEmailNotify, isEmailNotifyOpen }}
    >
      {children}
    </EmailNotifyContext.Provider>
  );
}

export function useEmailNotify(): EmailNotifyContextValue {
  const ctx = useContext(EmailNotifyContext);
  if (!ctx) throw new Error('useEmailNotify must be used within EmailNotifyProvider');
  return ctx;
}
