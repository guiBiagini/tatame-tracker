/**
 * Vitrine para a Chrome Web Store: monta cada captura em 1280×800 (ou o
 * bloco promocional 440×280) com o painel real e dados fictícios.
 * Uso: /store/?shot=1..5 | /store/?shot=promo  (ver scripts/store-shots.sh)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../../src/entrypoints/sidepanel/App';
import { buildSummary } from '../../src/core/summary';
import '../../src/entrypoints/sidepanel/style.css';
import './store.css';
import icon from '../../public/icon/128.png';
import { seedStore, storeAthletes, storeEvents, storeSnapshots } from './seed';

type Shot = { title: string; text: string; bullets?: string[]; tab: number; extra?: 'notification' | 'whatsapp' };

const SHOTS: Record<string, Shot> = {
  '1': {
    title: 'Tatame e horário de cada atleta, num só lugar',
    text: 'Acompanhe os atletas da sua academia em vários campeonatos de Jiu-Jitsu ao mesmo tempo.',
    bullets: ['Categoria, chave, tatame, horário e adversário', 'IBJJF, Meu Combate/CBJJE e iLutas', 'Painel lateral, sem trocar de aba'],
    tab: 0,
  },
  '2': {
    title: 'Avisa quando a chave sai',
    text: 'A extensão consulta os eventos sozinha, com mais frequência perto do dia das lutas.',
    bullets: ['Chave publicada', 'Luta agendada', 'Mudança de tatame ou horário'],
    tab: 0,
    extra: 'notification',
  },
  '3': {
    title: 'Resumo pronto para o grupo da academia',
    text: 'Um clique copia a agenda de todos os atletas para colar no WhatsApp.',
    tab: 0,
    extra: 'whatsapp',
  },
  '4': {
    title: 'Cadastre a equipe uma vez',
    text: 'Cole a lista de atletas. A extensão encontra cada um nas inscrições, mesmo com o nome abreviado.',
    bullets: ['Um atleta por linha, com equipe opcional', 'Reconhece variações do nome', 'Sugere correspondências para você confirmar'],
    tab: 1,
  },
  '5': {
    title: 'Cole o link do campeonato',
    text: 'A plataforma é reconhecida pelo link. O resto é automático.',
    bullets: ['IBJJF · Meu Combate/CBJJE · iLutas', 'Tudo fica no seu navegador, sem cadastro', 'Código aberto e gratuito'],
    tab: 2,
  },
};

const shotId = new URLSearchParams(location.search).get('shot') ?? '1';

function Promo() {
  return (
    <div className="promo">
      <img src={icon} alt="" />
      <div>
        <h1>Tatame Tracker</h1>
        <p>Tatame, horário e chave dos atletas da sua academia.</p>
      </div>
    </div>
  );
}

function Frame({ shot }: { shot: Shot }) {
  const summary = buildSummary(
    storeEvents.map((e) => storeSnapshots[e.id]!).filter((s) => s.bracketsPublished),
    storeAthletes,
  );
  return (
    <div className="frame">
      <div className="copy">
        <div className="brand">
          <img src={icon} alt="" />
          <span>Tatame Tracker</span>
        </div>
        <h1>{shot.title}</h1>
        <p>{shot.text}</p>
        {shot.bullets && (
          <ul>
            {shot.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        {shot.extra === 'whatsapp' && <pre className="bubble">{summary}</pre>}
      </div>
      <div className="panel">
        <App />
      </div>
      {shot.extra === 'notification' && (
        <div className="notification">
          <img src={icon} alt="" />
          <div>
            <b>João P. Silva: luta agendada</b>
            <span>Tatame 3 às 11:05 · Luta 31 (Semi-Final)</span>
            <small>Tatame Tracker</small>
          </div>
        </div>
      )}
    </div>
  );
}

seedStore().then(() => {
  const shot = SHOTS[shotId];
  document.body.classList.toggle('is-promo', shotId === 'promo');
  ReactDOM.createRoot(document.getElementById('shot')!).render(
    <React.StrictMode>{shot ? <Frame shot={shot} /> : <Promo />}</React.StrictMode>,
  );
  if (shot?.tab) {
    setTimeout(() => document.querySelectorAll<HTMLButtonElement>('nav button')[shot.tab]?.click(), 200);
  }
});
