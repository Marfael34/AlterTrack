import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  findNodeHandle,
  Keyboard,
  KeyboardEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  TextInput,
  TextInputProps,
  UIManager,
  View,
} from 'react-native';

interface KeyboardCenterContextType {
  registerFocusedInput: (targetOrRef: any) => void;
  keyboardHeight: number;
  isKeyboardVisible: boolean;
  handleFocus: (event: any) => void;
}

const KeyboardCenterContext = createContext<KeyboardCenterContextType | null>(null);

export const useKeyboardCenter = () => {
  return useContext(KeyboardCenterContext);
};

export interface KeyboardAwareCenteredScrollViewProps extends ScrollViewProps {
  extraBottomPadding?: number;
  topOffset?: number;
  children?: React.ReactNode;
}

/**
 * Mesure universelle d'un élément (ref ou node) en coordonnées d'écran
 */
const measureNodeInWindow = (
  node: any,
  callback: (x: number, y: number, width: number, height: number) => void,
) => {
  if (!node) return;
  if (typeof node.measureInWindow === 'function') {
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      callback(x, y, w, h);
    });
  } else if (typeof node.measure === 'function') {
    node.measure((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
      callback(pageX, pageY, w, h);
    });
  } else {
    const handle = typeof node === 'number' ? node : findNodeHandle(node);
    if (handle) {
      UIManager.measureInWindow(handle, (x: number, y: number, w: number, h: number) => {
        callback(x, y, w, h);
      });
    }
  }
};

/**
 * ScrollView intelligent qui centre automatiquement tout champ de saisie (TextInput)
 * au milieu exact de l'espace visible restant au-dessus du clavier virtuel (sur Android et iOS).
 */
export const KeyboardAwareCenteredScrollView = forwardRef<
  ScrollView,
  KeyboardAwareCenteredScrollViewProps
>(({ extraBottomPadding = 40, topOffset = 0, style, contentContainerStyle, children, onScroll, ...props }, ref) => {
  const containerRef = useRef<View>(null);
  const innerScrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef<number>(0);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const keyboardHeightRef = useRef<number>(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const isKeyboardVisibleRef = useRef<boolean>(false);
  const activeInputRef = useRef<any>(null);

  useImperativeHandle(ref, () => innerScrollRef.current as ScrollView, []);

  const scrollToTarget = useCallback(
    (target: any, kbHeightParam?: number, attempt = 1) => {
      if (!target || !innerScrollRef.current) return;

      measureNodeInWindow(target, (_tx: number, targetY: number, _tw: number, targetHeight: number) => {
        // Si l'élément n'est pas encore positionné ou mesurable, réessayer rapidement
        if ((targetHeight <= 0 || targetY <= 0) && attempt < 4) {
          setTimeout(() => {
            scrollToTarget(target, kbHeightParam, attempt + 1);
          }, 50);
          return;
        }

        const currentKbHeight =
          kbHeightParam !== undefined ? kbHeightParam : keyboardHeightRef.current;

        const performScroll = (containerY: number, containerHeight: number) => {
          const windowHeight = Dimensions.get('window').height;

          // Sur Android (adjustResize), containerHeight est déjà réduit par l'OS au-dessus du clavier.
          // Sur iOS, le clavier recouvre la vue, le haut du clavier est à windowHeight - currentKbHeight.
          const keyboardTop =
            Platform.OS === 'ios' && currentKbHeight > 0
              ? windowHeight - currentKbHeight
              : containerY + containerHeight;

          const visibleTop = Math.max(containerY, topOffset);
          const visibleBottom = Math.min(containerY + containerHeight, keyboardTop);
          const visibleHeight = Math.max(120, visibleBottom - visibleTop);

          // Cible : milieu exact de la zone visible
          const targetCenterY = visibleTop + visibleHeight / 2;

          // Centre vertical actuel du champ
          const inputCenterY = targetY + targetHeight / 2;

          // Décalage pour amener l'input au centre
          const delta = inputCenterY - targetCenterY;

          // Si le champ est déjà très proche du centre (seuil 8px), pas de saccade
          if (Math.abs(delta) < 8) return;

          const currentScroll = scrollOffsetRef.current;
          const nextScroll = Math.max(0, currentScroll + delta);

          innerScrollRef.current?.scrollTo({
            x: 0,
            y: nextScroll,
            animated: true,
          });
          scrollOffsetRef.current = nextScroll;
        };

        if (containerRef.current) {
          measureNodeInWindow(containerRef.current, (_cx: number, cY: number, _cw: number, cH: number) => {
            if (cH > 0) {
              performScroll(cY, cH);
            } else {
              const fallbackHeight = Dimensions.get('window').height;
              performScroll(topOffset, fallbackHeight - (currentKbHeight || 0));
            }
          });
        } else {
          const fallbackHeight = Dimensions.get('window').height;
          performScroll(topOffset, fallbackHeight - (currentKbHeight || 0));
        }
      });
    },
    [topOffset],
  );

  const registerFocusedInput = useCallback(
    (targetOrRef: any) => {
      if (!targetOrRef) return;
      activeInputRef.current = targetOrRef;

      // Si le clavier est déjà affiché (changement de champ à l'écran), centrer immédiatement
      if (isKeyboardVisibleRef.current || keyboardHeightRef.current > 0) {
        scrollToTarget(targetOrRef, keyboardHeightRef.current);
        setTimeout(() => {
          scrollToTarget(targetOrRef, keyboardHeightRef.current);
        }, 80);
      }
    },
    [scrollToTarget],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates.height;
      keyboardHeightRef.current = height;
      isKeyboardVisibleRef.current = true;
      setKeyboardHeight(height);
      setIsKeyboardVisible(true);

      if (activeInputRef.current) {
        // Défilement immédiat
        scrollToTarget(activeInputRef.current, height);

        // Réajustement après achèvement du resize d'Android
        setTimeout(() => {
          if (activeInputRef.current) {
            scrollToTarget(activeInputRef.current, height);
          }
        }, 120);

        // Stabilisation finale
        setTimeout(() => {
          if (activeInputRef.current) {
            scrollToTarget(activeInputRef.current, height);
          }
        }, 260);
      }
    };

    const onHide = () => {
      keyboardHeightRef.current = 0;
      isKeyboardVisibleRef.current = false;
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
      activeInputRef.current = null;
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToTarget]);

  const handleScroll = (event: any) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    if (onScroll) {
      onScroll(event);
    }
  };

  const handleFocus = useCallback((event: any) => {
    const target = event?.target || event?.currentTarget;
    if (target) {
      registerFocusedInput(target);
    }
  }, [registerFocusedInput]);

  // Donner suffisamment d'espace au ScrollView en bas quand le clavier est ouvert
  // afin que même le tout dernier champ puisse défiler jusqu'au centre de l'écran.
  const computedPaddingBottom =
    isKeyboardVisible && keyboardHeight > 0
      ? Math.max(keyboardHeight + 60, 320)
      : extraBottomPadding;

  return (
    <KeyboardCenterContext.Provider
      value={{
        registerFocusedInput,
        keyboardHeight,
        isKeyboardVisible,
        handleFocus,
      }}
    >
      <View ref={containerRef} style={[styles.wrapper, style]}>
        <ScrollView
          ref={innerScrollRef}
          {...props}
          style={styles.scrollView}
          contentContainerStyle={[
            contentContainerStyle,
            { paddingBottom: computedPaddingBottom },
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardCenterContext.Provider>
  );
});

KeyboardAwareCenteredScrollView.displayName = 'KeyboardAwareCenteredScrollView';

/**
 * Composant TextInput pré-connecté qui notifie le KeyboardAwareCenteredScrollView
 * lors du focus pour garantir le centrage exact dans la zone visible.
 */
export const CenteredTextInput = forwardRef<TextInput, TextInputProps>(
  ({ onFocus, ...props }, ref) => {
    const innerRef = useRef<TextInput>(null);
    const centerContext = useKeyboardCenter();

    useImperativeHandle(ref, () => innerRef.current as TextInput, []);

    const handleFocus = (event: any) => {
      const target = innerRef.current || event?.target || event?.currentTarget;
      if (centerContext && target) {
        centerContext.registerFocusedInput(target);
      }
      if (onFocus) {
        onFocus(event);
      }
    };

    return <TextInput ref={innerRef} {...props} onFocus={handleFocus} />;
  },
);

CenteredTextInput.displayName = 'CenteredTextInput';

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});

