import { useEffect, useRef } from 'react';

export function useModalBackButton(isOpen: boolean, onClose: () => void) {
  const hashRef = useRef<string>('');
  const onCloseRef = useRef(onClose);
  const isPushedRef = useRef<boolean>(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      const hash = '#modal-' + Math.random().toString(36).substring(2, 8);
      
      const handlePopState = () => {
        if (window.location.hash !== hashRef.current) {
          isPushedRef.current = false;
          onCloseRef.current();
        }
      };

      const timer = setTimeout(() => {
        if (!isMounted) return;
        hashRef.current = hash;
        const currentState = window.history.state;
        window.history.pushState(currentState, '', hash);
        isPushedRef.current = true;
        window.addEventListener('popstate', handlePopState);
      }, 50);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        window.removeEventListener('popstate', handlePopState);
        if (isPushedRef.current && window.location.hash === hashRef.current) {
          isPushedRef.current = false;
          window.history.back();
        }
      };
    }
  }, [isOpen]);
}
