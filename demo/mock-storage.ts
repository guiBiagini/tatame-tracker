/** Substitui `wxt/utils/storage` na demonstração: guarda no localStorage da página. */
type Listener<T> = (value: T | null, old: T | null) => void;

const PREFIX = 'tatame-demo:';

function defineItem<T>(key: string, opts: { fallback: T }) {
  const listeners = new Set<Listener<T>>();
  const read = (): T => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : opts.fallback;
    } catch {
      return opts.fallback;
    }
  };
  return {
    fallback: opts.fallback,
    async getValue() {
      return read();
    },
    async setValue(value: T) {
      const old = read();
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch {
        /* sem localStorage: a demo funciona, só não persiste */
      }
      listeners.forEach((l) => l(value, old));
    },
    watch(cb: Listener<T>) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

export const storage = { defineItem };
export type WxtStorageItem<T, _M = unknown> = ReturnType<typeof defineItem<T>>;
