import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Colors } from '../constants/colors';

/** Distance (px) ou vitesse de glissement au-delà de laquelle la feuille se ferme. */
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 1.2;
/** Mouvement vertical minimal avant de prendre la main (laisse passer les appuis). */
const DRAG_START_DISTANCE = 6;

interface SwipeDownSheetProps {
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Conteneur de modale ou de bottom sheet qui se ferme en glissant vers le bas
 * depuis la poignée du haut (EF-3.6). Le geste est limité à la poignée pour ne
 * pas gêner le défilement ni les champs du contenu.
 */
export const SwipeDownSheet: React.FC<SwipeDownSheetProps> = ({ onClose, style, children }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > DRAG_START_DISTANCE && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          translateY.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) {
            Animated.timing(translateY, {
              toValue: Dimensions.get('window').height,
              duration: 180,
              useNativeDriver: true,
            }).start(() => onCloseRef.current());
          } else {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [translateY],
  );

  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]}>
      <View
        {...panResponder.panHandlers}
        style={styles.handleZone}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        accessibilityHint="Glissez vers le bas pour fermer"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => onCloseRef.current()}
      >
        <View style={styles.handle} />
      </View>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  handleZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 10,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
});
