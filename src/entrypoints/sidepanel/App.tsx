import { useState } from 'react';
import { browser } from 'wxt/browser';
import { ADAPTERS, resolveUrl } from '../../adapters';
import type { Athlete, Entry, EventSnapshot, TrackedEvent } from '../../core/model';
import { STATUS_LABEL } from '../../core/model';
import { MATCH_THRESHOLD } from '../../core/names';
import { buildSummary } from '../../core/summary';
import type { Message, SyncResponse } from '../../lib/messages';
import { athletesItem, eventsItem, snapshotsItem } from '../../lib/storage';
import { useStored } from './useStored';

type Tab = 'lutas' | 'atletas' | 'eventos';

const sync = (msg: Omit<Message, 'type'>) =>
  browser.runtime.sendMessage({ type: 'sync', ...msg } satisfies Message) as Promise<SyncResponse>;

const newId = () => crypto.randomUUID();

export default function App() {
  const [tab, setTab] = useState<Tab>('lutas');
  const athletes = useStored(athletesItem);
  const events = useStored(eventsItem);
  const snapshots = useStored(snapshotsItem);

  return (
    <main>
      <header>
        <h1>🥋 Tatame Tracker</h1>
        <nav>
          {(['lutas', 'atletas', 'eventos'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'lutas' ? 'Lutas' : t === 'atletas' ? `Atletas (${athletes.length})` : `Eventos (${events.length})`}
            </button>
          ))}
        </nav>
      </header>
      {tab === 'lutas' && <FightsTab athletes={athletes} events={events} snapshots={snapshots} />}
      {tab === 'atletas' && <AthletesTab athletes={athletes} />}
      {tab === 'eventos' && <EventsTab events={events} snapshots={snapshots} />}
    </main>
  );
}

/* ------------------------------------------------------------------ Lutas */

function FightsTab(props: {
  athletes: Athlete[];
  events: TrackedEvent[];
  snapshots: Record<string, EventSnapshot>;
}) {
  const { athletes, events, snapshots } = props;
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ordered = events
    .map((e) => snapshots[e.id])
    .filter((s): s is EventSnapshot => !!s)
    .sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9'));
  const pending = events.filter((e) => !snapshots[e.id]);

  if (!athletes.length || !events.length) {
    return (
      <p className="empty">
        Cadastre os atletas da academia e cole o link de um campeonato na aba <b>Eventos</b>.
      </p>
    );
  }

  const refresh = async () => {
    setBusy(true);
    await sync({ force: true }).finally(() => setBusy(false));
  };
  const copy = async () => {
    await navigator.clipboard.writeText(buildSummary(ordered, athletes));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section>
      <div className="toolbar">
        <button onClick={refresh} disabled={busy}>
          {busy ? 'Atualizando…' : '↻ Atualizar tudo'}
        </button>
        <button onClick={copy}>{copied ? '✓ Copiado' : '📋 Copiar resumo (WhatsApp)'}</button>
      </div>
      {ordered.map((snap) => (
        <EventCard key={snap.eventId} snapshot={snap} athletes={athletes} />
      ))}
      {pending.map((event) => (
        <article key={event.id} className="card">
          <h2>{event.name}</h2>
          <p className="meta">{busy ? 'Consultando…' : 'Ainda não consultado. Clique em "Atualizar tudo".'}</p>
        </article>
      ))}
    </section>
  );
}

function EventCard({ snapshot, athletes }: { snapshot: EventSnapshot; athletes: Athlete[] }) {
  const sure = snapshot.entries.filter((e) => e.matchScore >= MATCH_THRESHOLD);
  const maybe = snapshot.entries.filter((e) => e.matchScore < MATCH_THRESHOLD);
  const nameOf = (id: string) => athletes.find((a) => a.id === id)?.name ?? '?';

  return (
    <article className="card">
      <h2>{snapshot.name}</h2>
      <p className="meta">
        {snapshot.date && <>{snapshot.date.split('-').reverse().join('/')} · </>}
        {snapshot.bracketsPublished ? 'Chave publicada' : 'Chave ainda não publicada'} · atualizado{' '}
        {timeAgo(snapshot.fetchedAt)}
      </p>
      {snapshot.error && <p className="error">Falha na última consulta: {snapshot.error}</p>}
      {!sure.length && !maybe.length && <p className="muted">Nenhum atleta da academia inscrito.</p>}
      {sure
        .sort((a, b) => nameOf(a.athleteId).localeCompare(nameOf(b.athleteId)))
        .map((entry) => (
          <EntryRow key={entry.athleteId + entry.category} entry={entry} name={nameOf(entry.athleteId)} />
        ))}
      {maybe.length > 0 && (
        <details>
          <summary>Possíveis correspondências ({maybe.length})</summary>
          {maybe.map((entry) => (
            <PossibleRow key={entry.athleteId + entry.category + entry.competitorName} entry={entry} athletes={athletes} />
          ))}
        </details>
      )}
    </article>
  );
}

function EntryRow({ entry, name }: { entry: Entry; name: string }) {
  const upcoming = entry.fights.filter((f) => !f.finished);
  const done = entry.fights.filter((f) => f.finished);
  return (
    <div className={`entry status-${entry.status}`}>
      <div className="entry-head">
        <b>{name}</b>
        {entry.competitorTeam && <span className="muted"> · {entry.competitorTeam}</span>}
      </div>
      <div className="muted small">{entry.category}</div>
      {upcoming.length === 0 && <div className="badge">{STATUS_LABEL[entry.status]}</div>}
      {upcoming.map((f, i) => (
        <div key={i} className="fight">
          <span className="mat">{f.mat ?? 'Tatame ?'}</span>
          <span className="time">{f.startsAt?.slice(11, 16) ?? f.when ?? '--:--'}</span>
          <span className="small">
            {f.fightNumber && `Luta ${f.fightNumber}`} {f.round && `(${f.round})`} {f.opponent && `vs ${f.opponent}`}
          </span>
        </div>
      ))}
      {done.length > 0 && (
        <div className="small muted">
          Encerradas: {done.map((f) => `${f.round ?? 'luta'} ${f.won === true ? '✔' : f.won === false ? '✖' : ''}`).join(', ')}
        </div>
      )}
    </div>
  );
}

function PossibleRow({ entry, athletes }: { entry: Entry; athletes: Athlete[] }) {
  const athlete = athletes.find((a) => a.id === entry.athleteId);
  if (!athlete) return null;
  const confirm = async () => {
    const all = await athletesItem.getValue();
    await athletesItem.setValue(
      all.map((a) => (a.id === athlete.id ? { ...a, aliases: [...new Set([...a.aliases, entry.competitorName])] } : a)),
    );
    await sync({ eventIds: [entry.eventId], force: true });
  };
  return (
    <div className="entry possible">
      <div>
        <b>{entry.competitorName}</b>
        {entry.competitorTeam && <span className="muted"> · {entry.competitorTeam}</span>}
      </div>
      <div className="small muted">
        Parece ser <b>{athlete.name}</b> ({Math.round(entry.matchScore * 100)}%) · {entry.category}
      </div>
      <button className="link" onClick={confirm}>
        É o mesmo atleta
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- Atletas */

function AthletesTab({ athletes }: { athletes: Athlete[] }) {
  const [bulk, setBulk] = useState('');

  const add = async () => {
    // Uma linha por atleta: "Nome" ou "Nome; Equipe"
    const parsed = bulk
      .split('\n')
      .map((l) => l.split(';').map((p) => p.trim()))
      .filter(([name]) => name)
      .map(([name, team]): Athlete => ({ id: newId(), name: name!, team: team || undefined, aliases: [] }));
    if (!parsed.length) return;
    await athletesItem.setValue([...athletes, ...parsed]);
    setBulk('');
    await sync({ force: true });
  };

  const remove = (id: string) => athletesItem.setValue(athletes.filter((a) => a.id !== id));

  return (
    <section>
      <label className="small muted">Um atleta por linha. Opcional: “Nome; Equipe” (ajuda a separar homônimos).</label>
      <textarea
        rows={4}
        value={bulk}
        onChange={(e) => setBulk(e.target.value)}
        placeholder={'João Pedro da Silva; Gracie Barra\nMaria Souza'}
      />
      <button onClick={add}>Adicionar</button>
      <ul className="list">
        {[...athletes]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((a) => (
            <li key={a.id}>
              <span>
                {a.name}
                {a.team && <span className="muted"> · {a.team}</span>}
                {a.aliases.length > 0 && <span className="small muted"> (também: {a.aliases.join(', ')})</span>}
              </span>
              <button className="link" onClick={() => remove(a.id)}>
                remover
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- Eventos */

function EventsTab({ events, snapshots }: { events: TrackedEvent[]; snapshots: Record<string, EventSnapshot> }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setError('');
    const ref = resolveUrl(url);
    if (!ref) {
      setError(`Link não reconhecido. Plataformas suportadas: ${ADAPTERS.map((a) => a.label).join(', ')}.`);
      return;
    }
    const id = `${ref.provider}:${ref.externalId}`;
    if (events.some((e) => e.id === id)) {
      setError('Este evento já está na lista.');
      return;
    }
    const event: TrackedEvent = { id, ...ref, name: url, addedAt: new Date().toISOString() };
    await eventsItem.setValue([...events, event]);
    setUrl('');
    setBusy(true);
    await sync({ eventIds: [id], force: true }).finally(() => setBusy(false));
  };

  const remove = async (id: string) => {
    await eventsItem.setValue(events.filter((e) => e.id !== id));
    const { [id]: _removed, ...rest } = await snapshotsItem.getValue();
    await snapshotsItem.setValue(rest);
  };

  return (
    <section>
      <label className="small muted">Cole o link do campeonato (IBJJF, Meu Combate/CBJJE ou iLutas).</label>
      <div className="row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        <button onClick={add} disabled={busy || !url}>
          {busy ? 'Buscando…' : 'Adicionar'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <ul className="list">
        {events.map((e) => (
          <li key={e.id}>
            <span>
              <a href={e.url} target="_blank" rel="noreferrer">
                {e.name}
              </a>
              <span className="small muted">
                {' '}
                · {ADAPTERS.find((a) => a.id === e.provider)?.label}
                {e.date && ` · ${e.date.split('-').reverse().join('/')}`}
                {snapshots[e.id]?.error && ' · ⚠ erro'}
              </span>
            </span>
            <button className="link" onClick={() => remove(e.id)}>
              remover
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}
