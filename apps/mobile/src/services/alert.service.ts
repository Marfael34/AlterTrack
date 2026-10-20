export type AlertType = 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface CustomAlertOptions {
  id?: string;
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  autoCloseMs?: number;
}

type AlertListener = (alert: CustomAlertOptions | null) => void;

class AlertServiceManager {
  private listeners: Set<AlertListener> = new Set();
  private currentAlert: CustomAlertOptions | null = null;

  public subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    if (this.currentAlert) {
      listener(this.currentAlert);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      listener(this.currentAlert);
    });
  }

  /**
   * Détecte intelligemment le type d'alerte en fonction du titre et du message
   */
  private detectType(
    title: string,
    message?: string,
    buttons?: AlertButton[],
  ): AlertType {
    const combined = `${title || ''} ${message || ''}`.toLowerCase();

    // Vérifier si un bouton est destructif
    const hasDestructive = buttons?.some((b) => b.style === 'destructive');
    if (hasDestructive) {
      return 'ERROR';
    }

    // Erreurs et échecs
    if (
      combined.includes('erreur') ||
      combined.includes('échec') ||
      combined.includes('impossible') ||
      combined.includes('supprim') ||
      combined.includes('déconnexion') ||
      combined.includes('refus') ||
      combined.includes('invalide')
    ) {
      return 'ERROR';
    }

    // Succès et validations
    if (
      combined.includes('succès') ||
      combined.includes('réussi') ||
      combined.includes('enregistré') ||
      combined.includes('mis à jour') ||
      combined.includes('expédié') ||
      combined.includes('activé') ||
      combined.includes('ajouté') ||
      combined.includes('✅') ||
      combined.includes('🎯') ||
      combined.includes('✉️') ||
      combined.includes('importé') ||
      combined.includes('défini')
    ) {
      return 'SUCCESS';
    }

    // Avertissements et exigences
    if (
      combined.includes('attention') ||
      combined.includes('avertissement') ||
      combined.includes('requis') ||
      combined.includes('obligatoire') ||
      combined.includes('manquant') ||
      combined.includes('validation') ||
      combined.includes('veuillez') ||
      combined.includes('⚠️') ||
      combined.includes('aucun') ||
      combined.includes('non configuré')
    ) {
      return 'WARNING';
    }

    return 'INFO';
  }

  /**
   * Affiche une pop-up d'alerte personnalisée
   */
  public show(options: CustomAlertOptions): void {
    const type = options.type || this.detectType(options.title, options.message, options.buttons);
    this.currentAlert = {
      ...options,
      id: Math.random().toString(36).substring(7),
      type,
    };
    this.notify();
  }

  /**
   * Remplacement direct de la signature native Alert.alert(title, message, buttons)
   */
  public alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    explicitType?: AlertType,
  ): void {
    this.show({
      title,
      message,
      buttons,
      type: explicitType,
    });
  }

  /**
   * Raccourci pour afficher une pop-up de succès
   */
  public success(title: string, message?: string, onOk?: () => void): void {
    this.show({
      title,
      message,
      type: 'SUCCESS',
      buttons: [{ text: 'Super !', onPress: onOk }],
    });
  }

  /**
   * Raccourci pour afficher une pop-up d'avertissement
   */
  public warning(title: string, message?: string, onOk?: () => void): void {
    this.show({
      title,
      message,
      type: 'WARNING',
      buttons: [{ text: 'Compris', onPress: onOk }],
    });
  }

  /**
   * Raccourci pour afficher une pop-up d'erreur
   */
  public error(title: string, message?: string, onOk?: () => void): void {
    this.show({
      title,
      message,
      type: 'ERROR',
      buttons: [{ text: 'Fermer', onPress: onOk }],
    });
  }

  /**
   * Raccourci pour afficher une boîte de confirmation personnalisée
   */
  public confirm(
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = 'Confirmer',
    cancelText: string = 'Annuler',
    isDestructive: boolean = false,
  ): void {
    this.show({
      title,
      message,
      type: isDestructive ? 'ERROR' : 'WARNING',
      buttons: [
        { text: cancelText, style: 'cancel' },
        {
          text: confirmText,
          style: isDestructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
    });
  }

  /**
   * Ferme l'alerte courante
   */
  public dismiss(): void {
    this.currentAlert = null;
    this.notify();
  }
}

export const AlertService = new AlertServiceManager();
