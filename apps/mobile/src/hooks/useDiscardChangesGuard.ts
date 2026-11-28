import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { AlertService } from '../services/alert.service';

/**
 * Demande confirmation avant de quitter un écran qui contient des
 * modifications non enregistrées, quel que soit le moyen utilisé : bouton
 * retour de l'en-tête, glissement iOS, geste ou bouton retour Android (EF-3.5).
 *
 * `leaveWithoutConfirm` sert aux sorties voulues (après un enregistrement ou
 * une suppression), qui ne doivent pas déclencher la confirmation.
 */
export function useDiscardChangesGuard(isDirty: boolean) {
  const navigation = useNavigation();
  const bypassRef = useRef(false);

  usePreventRemove(isDirty, ({ data }) => {
    if (bypassRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    AlertService.alert(
      'Abandonner les modifications ?',
      'Les modifications non enregistrées seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  const leaveWithoutConfirm = useCallback(() => {
    bypassRef.current = true;
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  return { leaveWithoutConfirm };
}
