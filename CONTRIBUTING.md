# Como contribuir

Obrigado por querer ajudar! O Tatame Tracker é feito pela comunidade do Jiu-Jitsu, e toda ajuda conta: reportar um site que mudou, sugerir uma plataforma, melhorar a interface ou escrever código.

## Regra de ouro: privacidade dos atletas

Muitos atletas são **menores de idade**. Em issues, pull requests, fixtures de teste e capturas de tela:

- use **somente nomes fictícios** (ex.: "Ana Exemplo Rocha", "Equipe Exemplo");
- ao salvar uma página real como fixture, **troque todos os nomes, equipes e professores** antes do commit;
- não publique prints com nomes reais.

Pull requests com dados reais de atletas não serão aceitos.

## Reportar um problema

Abra uma [issue](https://github.com/guiBiagini/tatame-tracker/issues/new/choose) usando o modelo **Bug** ou **Pedir nova plataforma**. O link do evento é a informação mais útil.

## Preparar o ambiente

Requisitos: Node.js 20+.

```bash
git clone https://github.com/guiBiagini/tatame-tracker.git
cd tatame-tracker
npm install
npm run dev     # Chrome com a extensão carregada e hot reload
npm run demo    # só a interface, em http://localhost:5199
```

> **Windows/PowerShell:** se aparecer "a execução de scripts foi desabilitada", use `npm.cmd` no lugar de `npm`.

## Estrutura

| Pasta | Conteúdo | Vai para a loja? |
|---|---|---|
| `src/core/` | Regras puras (nomes, sincronização, agenda, resumo) | Sim |
| `src/adapters/` | Um adaptador por plataforma | Sim |
| `src/entrypoints/`, `src/lib/` | Background, painel lateral e integração com o Chrome | Sim |
| `public/` | Ícones da extensão | Sim |
| `tests/` | Testes (Vitest) e fixtures HTML com nomes fictícios | Não |
| `demo/` | Interface no navegador, sem instalar (`npm run demo`) | Não |
| `demo/store/` | Vitrine usada para gerar as capturas da Chrome Web Store | Não |
| `assets/brand/` | SVGs-fonte do ícone | Não |
| `docs/store/` | Imagens publicadas na Chrome Web Store | Não |
| `scripts/` | Utilitários (gerar ícones e capturas) | Não |

Só o resultado do build (`.output/chrome-mv3`) é empacotado para a loja.

## Adicionar uma plataforma

1. Crie `src/adapters/<plataforma>.ts` implementando `ProviderAdapter` (`src/core/adapter.ts`):
   - `parseUrl(url)`: reconhece o link e **valida** o identificador (regex estrita; ele entra em URLs);
   - `fetchEvent(ref, http)`: nome, data, se a chave saiu e a lista de competidores;
   - `fetchFights` (opcional): só se a plataforma publicar tatame/horário por atleta.
2. Use sempre o `http` recebido (nunca `fetch` direto): ele aplica timeout, limite de tamanho e espera entre tentativas, e permite testar com fixtures.
3. Registre em `src/adapters/index.ts` e adicione o host em `host_permissions` (`wxt.config.ts`) e na lista de sites do `PRIVACY.md`.
4. Salve páginas de exemplo em `tests/fixtures/` (**com nomes fictícios**) e escreva `tests/<plataforma>.test.ts` usando `fakeHttp`.

Princípios: só páginas públicas, sem login no lugar do usuário, sem contornar captcha/anti-bot, poucas requisições.

## Antes de abrir o pull request

```bash
npm run compile
npm test
npm run build
```

O CI roda os mesmos comandos em cada pull request. Mudou a interface? Atualize as capturas com `bash scripts/store-shots.sh` (com `npm run demo` rodando).

Ao contribuir, você concorda que seu código seja distribuído sob a [GPL-3.0-or-later](LICENSE).
