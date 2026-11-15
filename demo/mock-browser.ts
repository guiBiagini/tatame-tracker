/**
 * Substitui `wxt/browser` na demonstração. "Atualizar" roda o mesmo runSync
 * da extensão (consulta real); só o evento IBJJF fictício fica de fora.
 */
import type { Message, SyncResponse } from '../src/lib/messages';
import { runSync } from '../src/lib/runner';
import { eventsItem } from '../src/lib/storage';
import { isDemoEvent } from './seed';

export const browser = {
  runtime: {
    async sendMessage(msg: Message): Promise<SyncResponse> {
      const ids = (msg.eventIds ?? (await eventsItem.getValue()).map((e) => e.id)).filter(
        (id) => !isDemoEvent(id),
      );
      try {
        const changes = ids.length ? await runSync({ eventIds: ids, force: msg.force }) : [];
        changes.forEach((c) => showToast(`🔔 ${c.title}`, c.message));
        return { ok: true, changes };
      } catch (e) {
        return { ok: false, changes: [], error: String(e) };
      }
    },
  },
};

/** Simula a notificação do Chrome no canto da tela. */
function showToast(title: string, message: string) {
  const el = document.createElement('div');
  el.className = 'demo-toast';
  const b = document.createElement('b');
  b.textContent = title;
  const span = document.createElement('span');
  span.textContent = message;
  el.append(b, span);
  document.getElementById('toasts')!.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}
