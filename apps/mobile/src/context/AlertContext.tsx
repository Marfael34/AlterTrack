import React, { createContext, useContext, useEffect, useState } from 'react';
import { CustomAlertModal } from '../components/CustomAlertModal';
import {
  AlertButton,
  AlertService,
  AlertType,
  CustomAlertOptions,
} from '../services/alert.service';

interface AlertContextType {
  showAlert: (options: CustomAlertOptions) => void;
  showSuccess: (title: string, message?: string, onOk?: () => void) => void;
  showWarning: (title: string, message?: string, onOk?: () => void) => void;
  showError: (title: string, message?: string, onOk?: () => void) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string,
    isDestructive?: boolean,
  ) => void;
  dismissAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentAlert, setCurrentAlert] = useState<CustomAlertOptions | null>(null);

  useEffect(() => {
    const unsubscribe = AlertService.subscribe((alert) => {
      setCurrentAlert(alert);
    });
    return unsubscribe;
  }, []);

  const showAlert = (options: CustomAlertOptions) => {
    AlertService.show(options);
  };

  const showSuccess = (title: string, message?: string, onOk?: () => void) => {
    AlertService.success(title, message, onOk);
  };

  const showWarning = (title: string, message?: string, onOk?: () => void) => {
    AlertService.warning(title, message, onOk);
  };

  const showError = (title: string, message?: string, onOk?: () => void) => {
    AlertService.error(title, message, onOk);
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string,
    isDestructive?: boolean,
  ) => {
    AlertService.confirm(title, message, onConfirm, confirmText, cancelText, isDestructive);
  };

  const dismissAlert = () => {
    AlertService.dismiss();
  };

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        showSuccess,
        showWarning,
        showError,
        showConfirm,
        dismissAlert,
      }}
    >
      {children}
      <CustomAlertModal
        alert={currentAlert}
        onDismiss={dismissAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert doit être utilisé au sein d\'un AlertProvider');
  }
  return context;
};
