# 🥋 Tatame Tracker

Extensão de navegador que centraliza **categoria, horário e tatame** dos atletas da sua academia em campeonatos de Jiu-Jitsu. Ela substitui a busca manual, atleta por atleta, nos sites de cada federação.

- Cadastre os atletas uma vez (inclusive em lote).
- Cole o link do campeonato: a extensão identifica a plataforma sozinha.
- Veja num painel lateral quem está inscrito, em qual categoria e, quando a organização publicar, **tatame, horário, número da luta e adversário**.
- Receba **notificações** quando a chave sair ou quando o tatame ou horário mudar.
- **Copie um resumo** pronto para o grupo da academia no WhatsApp.

## Plataformas suportadas

| Plataforma | Federações / exemplos | Dados | Como integra |
|---|---|---|---|
| **IBJJF** (bjjcompsystem.com) | IBJJF, CBJJ | Inscritos, chave, **tatame, horário, luta, adversário, resultado** | HTML do servidor |
| **Meu Combate** | CBJJE (eventocbjje.com.br) e outras do mesmo sistema | Inscritos por categoria e aviso de chave publicada | API JSON pública |
| **iLutas** | CBJJC, FMAS/PFBJJ, FCJJE, FEJJES, FJJCE… | Inscritos por categoria (a plataforma não publica tatame/horário) | HTML do servidor |

Planejadas: PDFs do Google Drive (BJJ Storm, Genesis Esportes), Smoothcomp (via leitura da página aberta pelo usuário) e FJJEMG/LMJJ.

## Chave e cronograma publicados perto da data

Muitas organizações só publicam a chave e o cronograma poucos dias antes do evento. A extensão trata isso como parte normal do ciclo:

```
inscrito → chave publicada → luta agendada (tatame/horário) → encerrada
```

A frequência de consulta se adapta à data do evento:

| Quando | Frequência |
|---|---|
| Mais de 7 dias antes | 1× por dia |
| 2 a 7 dias antes | a cada 3 h |
| Véspera | a cada 1 h |
| Dia do evento | a cada 5 min (IBJJF) / 1 h (demais) |
| Dia seguinte | a cada 6 h (resultados) |
| Depois disso | para de consultar |

## Arquitetura

```
src/
├── core/          # Lógica pura em TypeScript, sem dependência do navegador (roda em Node/backend)
│   ├── model.ts       # Modelo normalizado: Athlete, TrackedEvent, Entry, Fight, EventSnapshot
│   ├── adapter.ts     # Contrato ProviderAdapter + Http injetável
│   ├── names.ts       # Comparação de nomes (acentos, partículas, abreviações, equipe)
│   ├── sync.ts        # Orquestra: busca evento → cruza atletas → busca lutas → snapshot
│   ├── schedule.ts    # Frequência de atualização por proximidade do evento
│   ├── diff.ts        # Mudanças entre consultas → notificações
│   └── summary.ts     # Texto para WhatsApp
├── adapters/      # Um adaptador por PLATAFORMA (não por federação)
│   ├── ibjjf.ts
│   ├── meucombate.ts
│   ├── ilutas.ts
│   └── index.ts       # Registro + detecção pela URL
├── lib/           # Integração com a extensão (storage, execução, mensagens)
└── entrypoints/
    ├── background.ts  # Alarme a cada 5 min, sincronização e notificações
    └── sidepanel/     # Interface (React)
```

**Para adicionar uma plataforma:** crie `src/adapters/<nome>.ts` implementando `ProviderAdapter` (`parseUrl`, `fetchEvent` e, se a plataforma publicar tatame e horário, `fetchFights`). Depois registre o adaptador em `src/adapters/index.ts`, adicione o host em `host_permissions` no `wxt.config.ts` e escreva um teste com fixture.

## Desenvolvimento

Requisitos: Node.js 20+.

```bash
npm install
npm test          # testes (Vitest)
npm run compile   # checagem de tipos
npm run dev       # abre o Chrome com a extensão carregada e hot reload
npm run build     # gera .output/chrome-mv3
npm run demo      # abre a interface do painel em http://localhost:5199, sem instalar a extensão
```

A **demonstração** (`demo/`) usa a mesma interface e a mesma sincronização da extensão. Só o armazenamento do Chrome é trocado pelo `localStorage` da página. O evento da CBJJE é consultado de verdade; o evento IBJJF da demo é fictício e serve para mostrar tatame e horário.

### Instalar no Chrome sem a loja

1. `npm run build`
2. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione `.output/chrome-mv3`.
4. Clique no ícone da extensão para abrir o painel lateral.

## Princípios

- **Respeito aos sites:** só lê páginas públicas, consulta pouco quando o evento está longe, espaça as requisições e guarda cache local. Não contorna proteções anti-bot (Cloudflare, captcha) nem faz login no lugar do usuário.
- **Privacidade:** tudo fica no navegador do usuário (`chrome.storage.local`), sem servidor. As fixtures de teste usam **nomes fictícios**: nenhum dado real de atleta vai para o repositório.
- **Falha visível:** se um site mudar de estrutura, o evento mostra o erro e mantém os últimos dados conhecidos, em vez de exibir informação errada.
