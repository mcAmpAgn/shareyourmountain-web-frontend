import { useLayoutEffect, useState, type RefObject } from 'react';

/** Keep the list in the visible viewport, including when the mobile keyboard opens. */
export function useSuggestionPlacement(anchor: RefObject<HTMLDivElement | null>, visible: boolean) {
  const [layout, setLayout] = useState({ placement: 'below', maxHeight: 400 });
  useLayoutEffect(() => {
    if (!visible) return;
    const update = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const below = Math.max(0, bottom - rect.bottom - 20);
      const above = Math.max(0, rect.top - top - 20);
      const placement = below < 220 && above > below ? 'above' : 'below';
      const maxHeight = Math.max(
        96,
        Math.min(400, Math.floor(placement === 'above' ? above : below)),
      );
      setLayout((previous) =>
        previous.placement === placement && previous.maxHeight === maxHeight
          ? previous
          : { placement, maxHeight },
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    const observer = new ResizeObserver(update);
    if (anchor.current) observer.observe(anchor.current);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [anchor, visible]);
  return layout;
}
