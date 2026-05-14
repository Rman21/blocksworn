// 2026-05-14 — Phase 4.1 hotfix.
//
// Defensive `Object.defineProperty(window, ...)` wrapper.
//
// Problem: many src/ modules (bosses, ftue-state, reactivity-events, dialog,
// router, archetype-ticks) expose internal state to window via
// `Object.defineProperty(window, name, { configurable: true, get, set })`.
// This works fine when src/ is the primary runtime (the new modular shell
// at /shell.html). It THROWS a `TypeError: Cannot redefine property` when
// the same module is imported into the legacy single-HTML runtime (the
// sidecar entry at play.blocksworm.com/), because legacy declares the same
// names via `var X = …` in its inline scripts. `var` at the top level of
// an inline script creates a non-configurable own property on window —
// `Object.defineProperty` then throws.
//
// Fix: route all `defineProperty(window, …)` calls through `mirrorWindowProp`.
// It tries the descriptor first; if it throws, it silently falls back to
// leaving legacy's `var` value in place (legacy's value is the source of
// truth in that branch — the module-side variable still updates when
// `setX()` is called and remains accessible via direct module imports).

/**
 * Define a getter/setter property on `window` that mirrors a module-local
 * variable. Returns true when the bridge installed, false when legacy has
 * already claimed the name (non-configurable own property).
 *
 * Idempotent. Defensive — never throws.
 *
 * @param {string} name        Window property to mirror.
 * @param {Function} getter    Returns the current module-local value.
 * @param {Function} setter    Receives a new value from window writes.
 * @returns {boolean} `true` if installed, `false` on conflict.
 */
export function mirrorWindowProp(name, getter, setter) {
  if (typeof window === 'undefined') return false;
  try {
    const descriptor = { configurable: true, get: getter };
    if (typeof setter === 'function') descriptor.set = setter;
    Object.defineProperty(window, name, descriptor);
    return true;
  } catch (_e) {
    // Legacy `var name = …` already claimed this property as
    // non-configurable. Skip — legacy keeps its value, module keeps its own.
    return false;
  }
}

/**
 * Define a plain data property on `window` (no getter/setter). Same
 * defensive semantics. Used for module-side functions / frozen tables
 * that need to be reachable from legacy `<script>` blocks.
 *
 * @param {string} name
 * @param {*} value
 * @returns {boolean}
 */
export function mirrorWindowValue(name, value) {
  if (typeof window === 'undefined') return false;
  try {
    Object.defineProperty(window, name, {
      configurable: true,
      writable: true,
      enumerable: true,
      value,
    });
    return true;
  } catch (_e) {
    return false;
  }
}
