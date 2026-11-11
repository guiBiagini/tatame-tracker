import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { Change } from '../core/diff';
import type { Message, SyncResponse } from '../lib/messages';
import { runSync } from '../lib/runner';
import { settingsItem } from '../lib/storage';

/**
 * Um único alarme a cada 5 minutos; `isDue` decide quais eventos consultar
 * (de 1x/dia quando o evento está longe até a cada 5 min no dia das lutas).
 */
const TICK_ALARM = 'tick';
const TICK_MINUTES = 5;

export default defineBackground(() => {
  // Chrome: o ícone da extensão abre o painel lateral.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sidePanel = (browser as any).sidePanel;
  sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});

  browser.runtime.onInstalled.addListener(() => {
    browser.alarms.create(TICK_ALARM, { periodInMinutes: TICK_MINUTES });
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== TICK_ALARM) return;
    await notify(await runSync());
  });

  browser.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message?.type !== 'sync') return;
    runSync({ eventIds: message.eventIds, force: message.force })
      .then(async (changes) => {
        await notify(changes);
        sendResponse({ ok: true, changes: changes.length } satisfies SyncResponse);
      })
      .catch((err: unknown) =>
        sendResponse({ ok: false, changes: 0, error: String(err) } satisfies SyncResponse),
      );
    return true; // resposta assíncrona
  });
});

async function notify(changes: Change[]) {
  if (!changes.length || !(await settingsItem.getValue()).notifications) return;
  for (const change of changes.slice(0, 5)) {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: change.title,
      message: change.message,
    });
  }
  if (changes.length > 5) {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: 'Tatame Tracker',
      message: `Mais ${changes.length - 5} atualizações – abra o painel.`,
    });
  }
}
