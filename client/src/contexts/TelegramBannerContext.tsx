import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TelegramBannerContextType {
  isBannerVisible: boolean;
  setBannerVisible: (visible: boolean) => void;
}

const TelegramBannerContext = createContext<TelegramBannerContextType | undefined>(undefined);

export const useTelegramBanner = () => {
  const context = useContext(TelegramBannerContext);
  if (!context) {
    throw new Error('useTelegramBanner must be used within TelegramBannerProvider');
  }
  return context;
};

interface TelegramBannerProviderProps {
  children: ReactNode;
}

export const TelegramBannerProvider: React.FC<TelegramBannerProviderProps> = ({ children }) => {
  const [isBannerVisible, setBannerVisible] = useState(false);

  return (
    <TelegramBannerContext.Provider value={{ isBannerVisible, setBannerVisible }}>
      {children}
    </TelegramBannerContext.Provider>
  );
};

