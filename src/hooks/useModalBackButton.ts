import { useEffect, useRef } from 'react';

export function useModalBackButton(isOpen: boolean, onClose: () => void) {
  const hashRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      const hash = '#modal-' + Math.random().toString(36).substring(2, 8);
      hashRef.current = hash;
      
      const currentState = window.history.state;
      window.history.pushState(currentState, '', hash);
      
      const handlePopState = () => {
        if (window.location.hash !== hash) {
          onClose();
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.location.hash === hash) {
          window.history.back();
        }
      };
    }
  }, [isOpen, onClose]);
}
