import { useEffect, useState } from 'react';
import type { WxtStorageItem } from 'wxt/utils/storage';

/** Valor de um item do storage, atualizado quando o background grava. */
export function useStored<T>(item: WxtStorageItem<T, Record<string, unknown>>): T {
  const [value, setValue] = useState<T>(item.fallback);
  useEffect(() => {
    item.getValue().then(setValue);
    return item.watch((v) => setValue(v ?? item.fallback));
  }, [item]);
  return value;
}
