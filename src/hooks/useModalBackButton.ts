import { useEffect, useRef } from 'react';

export function useModalBackButton(isOpen: boolean, onClose: () => void) {
  const hashRef = useRef<string>('');
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const hash = '#modal-' + Math.random().toString(36).substring(2, 8);
      hashRef.current = hash;
      
      const currentState = window.history.state;
      window.history.pushState(currentState, '', hash);
      
      const handlePopState = () => {
        if (window.location.hash !== hash) {
          onCloseRef.current();
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.location.hash === hashRef.current) {
          window.history.back();
        }
      };
    }
  }, [isOpen]);
}
