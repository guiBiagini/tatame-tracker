# Política de Privacidade — Tatame Tracker

_Última atualização: 14 de novembro de 2026_

O Tatame Tracker é uma extensão de código aberto para o Chrome que ajuda academias a acompanhar categoria, chave, horário e tatame dos seus atletas em campeonatos de Jiu-Jitsu. Esta política explica quais dados a extensão usa e o que acontece com eles.

**Resumo:** tudo fica no seu navegador. O desenvolvedor não recebe, não coleta e não vende nenhum dado.

## Dados que você informa

- **Atletas:** nome, apelidos/variações do nome e, opcionalmente, equipe.
- **Eventos:** os links dos campeonatos que você quer acompanhar.
- **Preferências:** por exemplo, se as notificações estão ligadas.

## Dados obtidos das plataformas de campeonato

Para cada evento cadastrado, a extensão lê as **páginas públicas** de inscritos, chaves e cronograma da plataforma correspondente e guarda apenas o necessário para mostrar o resultado no painel: nome do evento e data, além de categoria, adversários, luta, horário e tatame dos atletas cadastrados por você.

## Onde os dados ficam

Todos os dados acima ficam armazenados **localmente no seu navegador** (`chrome.storage.local`). Eles não são sincronizados com a sua conta Google, não são enviados ao desenvolvedor nem a qualquer servidor próprio. Ao remover a extensão, o Chrome apaga esses dados.

## Comunicação com sites de terceiros

A extensão faz requisições somente para as plataformas de campeonato que ela suporta, e apenas para os eventos que você cadastrou:

- `www.bjjcompsystem.com` (IBJJF)
- `api.meucombate.com.br` (Meu Combate / CBJJE)
- `www.ilutas.com.br` (iLutas)

As requisições são feitas **sem cookies nem credenciais** e contêm apenas identificadores públicos do evento e dos competidores. **Os nomes dos atletas que você cadastra nunca são enviados**: a comparação de nomes é feita localmente. Esses sites têm suas próprias políticas de privacidade.

## O que a extensão não faz

- Não usa analytics, rastreamento, anúncios nem código remoto.
- Não lê as páginas que você navega nem o seu histórico.
- Não vende nem compartilha dados com terceiros, e não os usa para nenhuma finalidade além do funcionamento descrito acima (como avaliação de crédito).

## Permissões

| Permissão | Para quê |
|---|---|
| `storage` | Guardar localmente atletas, eventos e resultados. |
| `alarms` | Consultar os eventos periodicamente, com mais frequência perto da data. |
| `notifications` | Avisar quando a chave sai ou o horário/tatame muda. |
| `sidePanel` | Exibir a interface no painel lateral. |
| Acesso aos sites listados acima | Ler as páginas públicas de inscritos, chaves e cronograma. |

## Dados de menores

Atletas cadastrados podem ser menores de idade. Os dados permanecem apenas no dispositivo de quem os cadastrou, sob responsabilidade da academia ou do responsável que usa a extensão.

## Seus controles

Você pode editar ou excluir atletas e eventos a qualquer momento no painel da extensão, ou apagar tudo removendo a extensão.

## Alterações e contato

Mudanças nesta política são publicadas neste arquivo, com histórico no repositório. Dúvidas ou solicitações: abra uma issue em <https://github.com/guiBiagini/tatame-tracker/issues>.

---

### English summary

Tatame Tracker stores everything (athlete names you enter, tracked event links, fetched results and settings) locally in your browser via `chrome.storage.local`. No data is sent to the developer or any developer-owned server. The extension only contacts the supported competition platforms listed above, without cookies, to read their public pages. No analytics, tracking, ads or remote code. Data is never sold or shared. Contact: GitHub issues.
