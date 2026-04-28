'use client';
import Link from 'next/link';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'HOME' },
  { href: '/play', label: 'PLAY' },
  { href: '/heroes', label: 'HEROES' },
  { href: '/bosses', label: 'BOSSES' },
  { href: '/leaderboard', label: 'LEADERS' },
  { href: '/news', label: 'NEWS' },
  { href: '/about', label: 'ABOUT' },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-bg-dark/85 border-b border-gold-300/15">
      <div className="container-page flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-display text-xl tracking-[0.25em] font-black text-gold-300 group-hover:text-gold-100 transition-colors">
            BLOCKSWORM
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 font-display text-xs tracking-[0.15em] font-bold text-text-muted hover:text-gold-300 transition-colors rounded-md hover:bg-gold-300/5"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/play" className="btn-primary !px-5 !py-2 !text-xs ml-3">
            ▶ PLAY NOW
          </Link>
        </nav>

        {/* Mobile burger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden w-10 h-10 flex items-center justify-center text-gold-300 text-2xl"
          aria-label="Toggle menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-gold-300/15 bg-bg-dark">
          <div className="flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-6 py-3 font-display text-sm tracking-[0.15em] font-bold text-text-muted hover:text-gold-300 hover:bg-gold-300/5 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/play"
              onClick={() => setOpen(false)}
              className="mx-6 my-2 btn-primary !text-sm"
            >
              ▶ PLAY NOW
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
