'use client';

import { useEffect, useRef } from 'react';

/**
 * Track F.2 — "How it plays" lazy gameplay clip.
 *
 * Sits below the hero. Heavy enough (~360 KB mobile / ~1.4 MB desktop) that
 * we don't want it costing the LCP on first paint, so:
 *  - `preload="none"` keeps the bytes off the wire until the user scrolls
 *  - IntersectionObserver fires `play()` when the element passes the 50%
 *    visibility threshold and pauses it on exit, so the clip only animates
 *    when it's actually on screen
 *  - mobile <source> wins via the `media` query, falling back to desktop
 *  - poster JPG paints immediately so there's no white-flash before the
 *    first frame is decoded
 *
 * Aspect ratio is locked inline (886/1520) to prevent layout shift before
 * the video element knows its intrinsic dimensions.
 */
export function HowToPlayVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      className="block w-full h-auto rounded-2xl border border-gold-300/20 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
      loop
      muted
      playsInline
      preload="none"
      poster="/videos/landing/clip_B_ember_tutorial_poster.jpg"
      style={{ aspectRatio: '886 / 1520' }}
    >
      <source
        src="/videos/landing/clip_B_ember_tutorial_mobile.mp4"
        type="video/mp4"
        media="(max-width: 768px)"
      />
      <source
        src="/videos/landing/clip_B_ember_tutorial_desktop.mp4"
        type="video/mp4"
      />
    </video>
  );
}
