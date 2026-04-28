'use client';
import { useEffect, useState } from 'react';
import {
  initializeApp,
  getApp,
  getApps,
} from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

// Same Firebase project as the game (read-only public access).
// Per security rules: leaderboard reads are public (`allow read: if true`).
const firebaseConfig = {
  apiKey: 'AIzaSyC9oetrKqpzt16KL1dnnGjN3r4iLL-aLlQ',
  authDomain: 'blocksworm.firebaseapp.com',
  projectId: 'blocksworm',
  storageBucket: 'blocksworm.firebasestorage.app',
  messagingSenderId: '334495495523',
  appId: '1:334495495523:web:4cb7d467afea6c2c248f56',
};

interface ScoreRow {
  rank: number;
  uid: string;
  username: string;
  floor: number;
}

export function LeaderboardTable() {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const seasonId = 1; // TODO: read from /seasons/current doc once season rotation is wired
        const scoresRef = collection(db, 'leaderboard', `season_${seasonId}`, 'scores');
        const q = query(scoresRef, orderBy('floor', 'desc'), limit(100));
        const snap = await getDocs(q);
        if (cancelled) return;
        const out = snap.docs.map((d, i) => {
          const data = d.data() as { username?: string; floor?: number };
          return {
            rank: i + 1,
            uid: d.id,
            username: data.username || 'PLAYER',
            floor: data.floor || 0,
          };
        });
        setRows(out);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center text-text-muted">
        <div className="inline-block w-8 h-8 border-3 border-gold-300/20 border-t-gold-300 rounded-full animate-spin" />
        <p className="mt-4 text-sm">Loading leaderboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-muted text-sm">Leaderboard unavailable: {error}</p>
        <p className="mt-2 text-xs text-text-dim">Check back in a moment.</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-muted">No scores submitted yet.</p>
        <p className="mt-2 text-xs text-text-dim">
          Be the first — climb the Tower in-game.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold-300/15 bg-bg-mid overflow-hidden">
      <div className="grid grid-cols-[60px_1fr_80px] gap-2 px-4 py-3 border-b border-gold-300/15 bg-bg-dark">
        <span className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold">RANK</span>
        <span className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold">PLAYER</span>
        <span className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold text-right">FLOOR</span>
      </div>
      <div>
        {rows.map(r => {
          const isTop3 = r.rank <= 3;
          const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null;
          return (
            <div
              key={r.uid}
              className={`grid grid-cols-[60px_1fr_80px] gap-2 px-4 py-3 border-b border-gold-300/5 last:border-b-0 ${
                isTop3 ? 'bg-gold-300/5' : ''
              }`}
            >
              <span className="font-mono font-bold text-text-secondary text-sm">
                {medal ? <span className="text-base">{medal}</span> : `#${r.rank}`}
              </span>
              <span className="text-sm font-medium text-white truncate">{r.username}</span>
              <span className="font-mono font-bold text-grove text-sm text-right">F{r.floor}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
