# Changelog

Todas as mudanças relevantes da extensão. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- CI no GitHub Actions (tipos, testes e build), modelos de issue e de pull request, guia de contribuição.

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

[Não lançado]: https://github.com/guiBiagini/tatame-tracker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/guiBiagini/tatame-tracker/releases/tag/v0.1.0
