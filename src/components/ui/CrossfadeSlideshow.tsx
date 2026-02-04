import React, { useEffect, useMemo, useState } from 'react';

export interface CrossfadeSlideshowProps {
  urls: string[];
  alt: string;
  intervalMs?: number;
  fadeMs?: number;
}

const normalizeUrls = (urls: string[]) => {
  const cleaned = urls
    .filter((u) => typeof u === 'string')
    .map((u) => u.trim())
    .filter(Boolean);
  // de-dupe while preserving order
  return Array.from(new Set(cleaned));
};

export function CrossfadeSlideshow({
  urls,
  alt,
  intervalMs = 4500,
  fadeMs = 1400,
}: CrossfadeSlideshowProps) {
  const normalizedUrls = useMemo(() => normalizeUrls(urls), [urls]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;

    const update = () => setReduceMotion(!!mq.matches);
    update();

    // Safari < 14 fallback: addListener/removeListener
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedUrls.join('|')]);

  useEffect(() => {
    if (reduceMotion) return;
    if (normalizedUrls.length <= 1) return;

    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % normalizedUrls.length);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [reduceMotion, normalizedUrls.length, intervalMs]);

  if (normalizedUrls.length === 0) {
    return null;
  }

  const transition = reduceMotion ? 'none' : `opacity ${fadeMs}ms ease-in-out`;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {normalizedUrls.map((url, idx) => {
        const isActive = idx === activeIndex;
        return (
          <img
            key={`${idx}-${url}`}
            src={url}
            alt={isActive ? alt : ''}
            aria-hidden={isActive ? undefined : true}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              opacity: isActive ? 1 : 0,
              transition,
              willChange: reduceMotion ? undefined : 'opacity',
            }}
          />
        );
      })}
    </div>
  );
}

