import { useCallback, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AlertService as Alert } from '../services/alert.service';
import type { CvUploadResult } from '../types/config';
import {
  PickedCvFile,
  pickCvFile,
  uploadPickedCv,
} from '../services/cv.service';

interface UseCvImportOptions {
  /** Appelé après un import réussi (le profil est déjà rafraîchi). */
  onImported?: (result: CvUploadResult) => void;
}

/**
 * Parcours complet d'import du CV : sélection, validation, envoi, messages
 * d'erreur et bouton « Réessayer » sans devoir choisir à nouveau le fichier.
 */
export function useCvImport({ onImported }: UseCvImportOptions = {}) {
  const { user, refreshProfile } = useAuth();
  const [importing, setImporting] = useState(false);
  const inFlight = useRef(false);

  const upload = useCallback(
    async (file: PickedCvFile): Promise<void> => {
      inFlight.current = true;
      setImporting(true);
      try {
        const result = await uploadPickedCv(file, user?.fullName);
        await refreshProfile().catch(() => undefined);
        onImported?.(result);
        Alert.alert(
          'CV importé ✅',
          `Le fichier « ${result.cvOriginalName ?? 'CV.pdf'} » est enregistré et sera joint à vos e-mails.`,
        );
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "L'enregistrement du CV a échoué.";
        Alert.alert("Échec de l'import du CV", message, [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Réessayer', onPress: () => void upload(file) },
        ]);
      } finally {
        inFlight.current = false;
        setImporting(false);
      }
    },
    [user?.fullName, refreshProfile, onImported],
  );

  const importCv = useCallback(async () => {
    if (inFlight.current) return;
    const picked = await pickCvFile();

    switch (picked.kind) {
      case 'canceled':
        return;
      case 'invalid':
        Alert.alert('Import du CV', picked.message);
        return;
      case 'unavailable':
        Alert.alert(
          'Accès aux fichiers impossible',
          picked.message,
          Platform.OS === 'web'
            ? undefined
            : [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Ouvrir les réglages',
                  onPress: () => void Linking.openSettings(),
                },
              ],
        );
        return;
      case 'picked':
        await upload(picked.file);
    }
  }, [upload]);

  return { importCv, importing };
}
