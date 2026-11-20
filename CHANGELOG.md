# Changelog

Todas as mudanças relevantes da extensão. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [0.2.0] - 2026-11-15

### Adicionado
- **iLutas: chaves.** Fase, primeiro adversário (com equipe) e tamanho da chave de cada atleta, abrindo só as chaves das categorias dele. Encontra também categorias juntadas pelo organizador.
- **iLutas: previsão de horário pelo cronograma**, exibida como "Previsão ~HH:MM" com a linha do cronograma usada. Não conta como luta agendada.
- Notificações "adversário na chave" e "previsão de horário".
- iLutas no dia do evento (lista de inscritos fora do ar): reaproveita a consulta anterior; sem ela, varre as chaves no máximo a cada 6 h.
- Links do site da IBJJF (`ibjjf.com/events/...`) além do bjjcompsystem; a data do evento vem dessa página.
- CI no GitHub Actions (tipos, testes e build), modelos de issue e de pull request, guia de contribuição.

### Corrigido
- Eventos IBJJF sem data (o bjjcompsystem não publica): a data passa a vir do site da IBJJF ou da primeira luta. Antes, sem data, a extensão consultava só a cada 6 h mesmo no dia das lutas.
- Timeout ou queda de conexão agora geram nova tentativa, em vez de falhar a consulta inteira.
- Acentos corrompidos em páginas que não usam UTF-8 (checagem do iLutas, em ISO-8859-1): o texto agora é decodificado pelo charset informado pelo site.

## [0.1.0] - 2026-11-14

Primeira versão enviada à Chrome Web Store.

### Adicionado
- Painel lateral com as abas Lutas, Atletas e Eventos.
- Adaptadores IBJJF (bjjcompsystem), Meu Combate/CBJJE e iLutas.
- Comparação de nomes tolerante a acentos, abreviações e nomes incompletos, com sugestões para confirmar.
- Consulta automática com frequência proporcional à proximidade do evento.
- Notificações de chave publicada, luta agendada e mudança de tatame/horário.
- Resumo para WhatsApp.
- Demonstração no navegador (`npm run demo`), política de privacidade e capturas da loja.

### Segurança
- Validação dos identificadores de evento, aceitação de URLs somente http(s), mensagens aceitas só do próprio painel, timeout e limite de tamanho nas requisições.

[Não lançado]: https://github.com/guiBiagini/tatame-tracker/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/guiBiagini/tatame-tracker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/guiBiagini/tatame-tracker/releases/tag/v0.1.0
