# SPEC — Chronicles & Sheet

> Especificação descritiva do projeto **como ele está hoje**. A primeira versão deste documento analisou o código original das alunas. Depois disso vieram correções, e as seções abaixo descrevem o comportamento atual. A seção 9 registra o que foi resolvido e o que continua pendente.

---

## 1. Visão geral

**Chronicles & Sheet** é uma aplicação web de página única (SPA estática) de apoio a **RPG de mesa**. Ela reúne num só lugar as ferramentas que um jogador usa durante uma sessão:

- ficha do personagem (dados básicos, barras de vida/sanidade/esforço, atributos);
- inventário;
- rolador de dados;
- diário de campanha com tags e busca;
- dois temas visuais ("Ficha de Campo" e "Diário Manuscrito");
- backup em arquivo `.json` (exportar/importar).

Tudo roda **no navegador**, sem servidor, sem build e sem bibliotecas externas. Os dados ficam salvos no `localStorage`. O projeto foi pensado para ser publicado direto no **GitHub Pages**.

### 1.1 Intenção do projeto

O arquivo `TEXTOS SCRIPT JOGO.txt` mostra a origem do projeto: é um **prompt** escrito para uma IA ("Atue como um desenvolvedor web especialista...") que descreve os requisitos do site. O código (`index.html`, `styles.css`, `script.js`) é a implementação desses requisitos, com alguns **acréscimos** que não estavam no prompt (barras de Sanidade e Esforço, botão de limpar histórico de dados, botão de ocultar atributos).

Objetivos declarados no prompt:

| Objetivo | Descrição |
|---|---|
| 100% client-side | Sem backend; pronto para GitHub Pages |
| Vanilla | HTML5 + CSS3 + JavaScript puro, sem frameworks |
| Persistência local | `localStorage` |
| Portabilidade | Exportar/importar backup `.json` |
| Duas "personalidades" visuais | Interface técnica moderna × estilo pergaminho/fantasia |

---

## 2. Estrutura de arquivos

```
Ana Livia e Zarpelon/
├── index.html               (284 linhas)  Estrutura e conteúdo da página
├── styles.css               (702 linhas)  Visual, temas e responsividade
├── script.js                (929 linhas)  Estado, lógica, eventos e renderização
├── TEXTOS SCRIPT JOGO.txt   ( 43 linhas)  Prompt/requisitos originais do projeto
├── README.md                              Apresentação, créditos e como usar
├── CLAUDE.md                              Regras para quem for alterar o projeto
└── SPEC.md                                Este documento
```

Não existe `package.json`, pasta de assets nem testes automatizados no repositório. O código está no GitHub (`professoralissonlucas/chronicles-sheet`, branch `main`). Para rodar, basta abrir `index.html` no navegador.

Separação de responsabilidades:

- **HTML** → define *todas* as seções e campos de forma estática. Apenas as listas (inventário, histórico de dados, diário) e as opções do filtro de tags são geradas pelo JS.
- **CSS** → define os dois temas com **variáveis CSS** (custom properties) e decide quais painéis aparecem em cada tema.
- **JS** → mantém um único objeto `state`, salva no `localStorage` a cada mudança e redesenha a parte afetada da tela.

---

## 3. Interface (index.html)

Idioma `pt-BR`. O `<body>` começa com `data-theme="field"`.

```
.app-shell
├── header.topbar
│   ├── "RPG de mesa" / h1 "Chronicles & Sheet"
│   └── ações: [Alternar tema] [Exportar Backup] [Importar Backup (input file oculto)]
└── main.layout  (grid de 12 colunas)
    ├── section  Ficha Técnica do Personagem   (6 colunas)
    ├── section  Inventário                    (6 colunas)
    ├── section  Rolador de Dados              (6 colunas)
    └── section.journal-panel  Diário de Bordo (largura total)
```

### 3.1 Ficha Técnica do Personagem

| Elemento | ID / seletor | Observação |
|---|---|---|
| Nome | `#charName` | texto |
| Classe | `#charClass` | texto |
| Nível | `#charLevel` | número, `min=1 max=99` |
| Anotações gerais | `#charNotes` | textarea |
| Pontos de Vida | `#hpBar`, `#hpCurrentText`, `#hpMaxInput`, `#hpStatus` | botões `-5 -1 +1 +5` com `data-stat="hp"` |
| Sanidade | `#sanityBar`, `#sanityCurrentText`, `#sanityMaxInput`, `#sanityStatus` | botões `.vital-btn` com `data-stat="sanity"` |
| Pontos de Esforço | `#effortBar`, `#effortCurrentText`, `#effortMaxInput`, `#effortStatus` | botões `.vital-btn` com `data-stat="effort"` |
| Atributos | `.attribute[data-attribute="forca"...]` | FOR, DES, CON, INT, SAB, CAR — número `1–30`. O JS escreve no campo o valor salvo no state |
| Ocultar atributos | `#toggleAttributesBtn` | alterna entre "Ocultar" e "Mostrar" e esconde `.attributes-grid`; fica à direita do título "Atributos" (`.attributes-header` usa o mesmo alinhamento de `.hp-header`) |

O valor **atual** de cada barra é só exibido (`<strong>`); muda pelos botões. O valor **máximo** é editável num `<input>`.

### 3.2 Inventário

Formulário `#inventoryForm` com `#inventoryId` (oculto, guarda o ID em edição), `#itemName` (obrigatório), `#itemQty` (mín. 1), `#itemDescription`, botões `#saveItemBtn` e `#cancelEditBtn` (oculto até entrar em modo edição). Lista: `#inventoryList`.

### 3.3 Rolador de Dados

Sete botões `.dice-btn` com `data-sides` = 4, 6, 8, 10, 12, 20, 100. Exibição `#lastRoll`, botão `#clearDiceHistoryBtn`, lista `#diceHistory`.

### 3.4 Diário de Bordo

Formulário `#journalForm` com título (obrigatório), tags (texto separado por vírgula) e registro (obrigatório). Filtros: busca livre `#journalSearch` e `<select id="journalTagFilter">`. Lista: `#journalList`.

### 3.5 Acessibilidade

- Seções com `aria-labelledby` apontando para seus títulos.
- Listas e mensagens de status com `aria-live="polite"` (leitores de tela anunciam mudanças).
- `aria-label` nos inputs de máximo e no botão de tema.

---

## 4. Modelo de dados (script.js)

Chave no `localStorage`: **`chronicles-sheet-state-v1`** (o sufixo `v1` indica intenção de versionar o formato).

```js
state = {
  theme: 'field' | 'journal',
  attributesHidden: boolean,          // preferência do botão Ocultar/Mostrar (padrão false)
  character: {
    name: string,
    className: string,
    level: number,
    notes: string,
    hp:     { current: number, max: number },
    sanity: { current: number, max: number },
    effort: { current: number, max: number },
    attributes: { forca, destreza, constituicao, inteligencia, sabedoria, carisma } // números
  },
  inventory:   [{ id, name, quantity, description }],
  diceHistory: [{ id, result: "d20 = 15", timestamp: ISOString }],   // máx. 12
  journal:     [{ id, title, content, tags: ["#Tag"], timestamp: ISOString }]
}
```

### 4.1 Estado padrão (primeiro acesso)

Personagem de exemplo **Aelric Vale**, Bárbaro nível 3, HP 24/30, Sanidade 12/20, Esforço 4/8, atributos 16/12/15/9/11/10; inventário com "Poção de cura" ×2 e "Mapa antigo" ×1; uma rolagem `d20 = 15`; uma entrada de diário "Primeira entrada" com `#Combate` e `#Quest`. A intenção é a página nunca abrir vazia e já demonstrar cada recurso. Esse exemplo (`defaultState`) aparece **só no primeiro acesso**, quando não há nada salvo (ou quando o que está salvo está corrompido, ou o armazenamento está bloqueado).

### 4.2 Valores neutros (`emptyState`)

Quando os dados carregados ou um backup importado **não têm** alguma parte, essa parte é completada com valores neutros, e não com o exemplo: personagem sem nome, sem classe e sem anotações; nível 1; barras **cheias** com os máximos padrão (HP 30/30, Sanidade 20/20, Esforço 8/8); todos os atributos em 10; `inventory`, `diceHistory` e `journal` vazios; tema `field`; atributos visíveis.

### 4.3 IDs

`generateId()` usa `crypto.randomUUID()` quando disponível; senão monta `id-<timestamp>-<aleatório hex>`.

---

## 5. Fluxo da aplicação

```
carrega script.js (no fim do <body>)
  └─ state = loadState()
        ├─ não há nada salvo     → cópia de defaultState
        ├─ há JSON válido        → normalizeState(JSON salvo)
        ├─ JSON corrompido       → aviso no console + defaultState
        └─ armazenamento bloqueado → aviso único no console + defaultState (só em memória)
  └─ init()
        ├─ bind* (registra todos os eventos)
        └─ renderAll()
```

Padrão usado em toda a aplicação — **evento → altera `state` → `saveState()` → render da área afetada**:

| Função de render | O que desenha |
|---|---|
| `renderTheme` | `data-theme` do body e texto do botão de tema |
| `renderCharacterBlock` | nome, classe, nível, anotações |
| `renderAttributes` | valores dos 6 atributos, visibilidade da grade e texto/`aria-label` do botão Ocultar/Mostrar |
| `renderHp` / `renderSanity` / `renderEffort` | largura da barra, número atual, máximo, mensagem de status |
| `renderInventory` | lista de itens + liga os botões Editar/Remover |
| `renderDiceHistory` | histórico + "Última rolagem" |
| `renderJournal` | reconstrói o `<select>` de tags, aplica filtros e desenha as entradas |

Não há framework reativo: o redesenho é manual, por bloco, geralmente limpando `innerHTML` e recriando a lista.

**Campos numéricos (nível, atributos, máximos):** o evento `input` salva só quando o valor digitado é válido e **não reescreve o campo**, para não atrapalhar a digitação. O evento `change` (sair do campo ou apertar Enter) aplica os limites, salva e redesenha. O helper `clampNumber(valor, min, max, padrão)` faz a conversão e o limite.

**Armazenamento:** `saveState` e `loadState` usam `try/catch`. Se o `localStorage` estiver bloqueado ou cheio, o site continua funcionando só em memória e mostra **um único** `console.warn`, sugerindo usar "Exportar Backup".

---

## 6. Regras de negócio por funcionalidade

### 6.1 Ficha
- Nome, classe e anotações são salvos a cada tecla (`input`).
- Nível: enquanto a pessoa digita, só valores válidos são salvos, e o campo pode ficar vazio. Ao sair do campo, o nível fica entre **1 e 99**; vazio ou inválido vira 1.
- Atributos: mesma lógica, com limite de **1 a 30**. Se o campo ficar vazio, volta ao último valor salvo. Os valores entram no backup.
- Botão Ocultar/Mostrar: esconde ou mostra a grade de atributos (classe `.hidden`) e salva a preferência em `state.attributesHidden`.

### 6.2 Barras vitais (HP, Sanidade, Esforço)
- Botões somam/subtraem e o resultado é limitado a `0 ≤ atual ≤ máximo`.
- Alterar o máximo: enquanto a pessoa digita, valores vazios ou menores que 1 são ignorados. Ao sair do campo, o máximo é confirmado (vazio volta ao último válido) e o **atual é reduzido para não passar do máximo**. Esse ajuste é feito só no `change` para não perder o valor atual no meio da digitação (ex.: trocar 30 por 25 passa por "2").
- Porcentagem = `atual / máximo`, limitada a 0–100%, vira a largura da barra.
- Três estados, com mensagens próprias para cada barra:

| Condição | Classe | Exemplo (HP) |
|---|---|---|
| atual ≤ 0 | `critical` (vermelho) | "HP zerado. O personagem caiu e precisa de atenção imediata." |
| < 25% | `warning` (amarelo) | "HP crítico! O personagem está em risco iminente." |
| restante | `safe` (verde) | "HP está estável." |

- Cores: HP usa gradiente verde→amarelo→vermelho (variável do tema); Sanidade, gradiente roxo; Esforço, gradiente laranja/âmbar.

### 6.3 Inventário
- **Adicionar**: item novo entra no **topo** da lista (`unshift`). Nome vazio é rejeitado (foco volta ao campo). Quantidade mínima 1.
- **Editar**: "Editar" copia o item para o formulário, guarda o ID no campo oculto, troca o botão para "Salvar alterações" e mostra "Cancelar edição". Ao enviar, substitui o item com o mesmo ID.
- **Remover**: imediato, sem confirmação. Se o item removido é o que está sendo editado, o formulário sai do modo de edição e é limpo (mesmo efeito de "Cancelar edição").
- Lista vazia mostra: "Nenhum item no inventário. Adicione o primeiro item."

### 6.4 Rolador de dados
- `Math.floor(Math.random() * lados) + 1`.
- Resultado no formato `"d20 = 15"` com timestamp; entra no topo; o histórico guarda **as 12 últimas**.
- Datas no formato curto `pt-BR` (`Intl.DateTimeFormat`, ex.: `20/11/2026 14:32`).
- "Limpar histórico" esvazia a lista e volta "Última rolagem" para "Nenhuma". O próprio `renderDiceHistory` também mostra "Nenhuma" sempre que o histórico estiver vazio (por exemplo, depois de importar um backup sem rolagens).

### 6.5 Diário de bordo
- Título e registro obrigatórios. Entradas novas no topo.
- Tags (`normalizeTags`): separa por vírgula, tira espaços, adiciona `#` se faltar, remove espaços internos, elimina duplicadas, **máximo 6 tags**. Ex.: `"combate, #NPC, lore antigo"` → `["#combate", "#NPC", "#loreantigo"]`.
- O `<select>` de tags é reconstruído a cada render com todas as tags existentes, em ordem alfabética, preservando a seleção atual se ainda existir.
- Filtro: a entrada aparece se (busca vazia **ou** termo aparece no título/conteúdo/tags, sem diferenciar maiúsculas) **e** (filtro "Todas" **ou** a entrada tem a tag escolhida, comparação exata).
- Conteúdo exibido com `white-space: pre-wrap` (mantém quebras de linha).
- Não há como editar ou excluir entradas do diário.

### 6.6 Temas
- Botão alterna `field` ↔ `journal`, grava em `state.theme` e atualiza `body[data-theme]`. O texto do botão mostra **o tema para o qual vai mudar**.
- Além do visual, o CSS **esconde painéis** conforme o tema:
  - **Ficha de Campo** (`field`): esconde o **Diário de Bordo**.
  - **Diário Manuscrito** (`journal`): esconde o **Rolador de Dados**.

  A intenção aparente é cada modo ter um foco: o modo técnico para a mesa/combate (dados) e o modo manuscrito para narrativa (diário). Isso vai além do prompt original, que pedia só troca de aparência.

### 6.7 Backup
- **Exportar**: serializa `state` com indentação, cria um `Blob` e força o download de `chronicles-sheet-backup-AAAA-MM-DD-HH-MM-SS.json`.
- **Importar**: lê o arquivo e faz `JSON.parse`. Depois, `looksLikeBackup` confere se o conteúdo parece um backup deste site: precisa ser um objeto com `character` (objeto) **ou** pelo menos uma das listas `inventory`, `journal` ou `diceHistory`. Se passar, o conteúdo vai para `normalizeState`, substitui o estado e é salvo. Em seguida, o inventário **sai do modo de edição** (`clearInventoryForm`, o mesmo do "Cancelar edição") e os formulários do inventário e do diário são limpos. Por fim, a tela é redesenhada e aparece o `alert` de sucesso. Se o JSON for malformado ou não parecer um backup, aparece o `alert` "Arquivo inválido..." e **nada é alterado**. O input é limpo no final, para permitir importar o mesmo arquivo de novo.
- Backups exportados por versões anteriores (sem `attributesHidden`, sem `sanity`/`effort`) continuam importando. Backups parciais (ex.: só `journal`) também são aceitos. Em todos os casos, o que falta recebe os **valores neutros** (ver 4.2), nunca o personagem de exemplo.

### 6.8 Normalização e segurança
`normalizeState` é usado ao carregar do `localStorage` e ao importar:
- Entrada que não é objeto (array, número, `null`) é tratada como `{}`.
- Faz *deep merge* sobre uma cópia de `emptyState` (valores neutros, ver 4.2): chaves que faltam são completadas; arrays recebidos substituem os vazios; uma lista ausente ou que não seja array fica vazia.
- **Personagem**: `name`, `className` e `notes` viram texto; `level` fica entre 1 e 99; cada atributo fica entre 1 e 30 (inválido vira 10).
- **Barras vitais**: `hp`, `sanity` e `effort` ausentes, `null` ou inválidos ficam cheios com o máximo padrão; `max ≥ 1` e `0 ≤ current ≤ max` (`current` inválido vira o máximo).
- **inventory**: descarta itens sem `name`; `quantity` vira número ≥ 1; `description` vira texto.
- **diceHistory**: descarta entradas sem `result` em texto; no máximo 12.
- **journal**: descarta entradas sem `title` ou `content`; `tags` vira sempre um array de textos (texto solto passa por `normalizeTags`).
- **IDs** ausentes ou repetidos são gerados de novo; **timestamps** inválidos viram `null` (exibidos como "Sem data", em vez de quebrar o `formatDate`).
- `theme` inválido volta para `field`; `attributesHidden` que não seja booleano vira `false`.
- Campos extras desconhecidos nos itens são preservados.

`escapeHtml` é usado em todo texto do usuário inserido via `innerHTML` (nomes, descrições, tags, títulos, conteúdo, `data-id` e `value` das opções), evitando injeção de HTML.

---

## 7. Estilo e temas (styles.css)

### 7.1 Sistema de variáveis
Todas as cores vêm de variáveis em `:root` (tema **field**), redefinidas em `body[data-theme='journal']`. Principais tokens: `--bg`, `--panel`, `--primary`, `--accent`, `--text`, `--muted`, `--danger`, `--success`, `--warning`, `--border`, `--hp-fill`, `--input-bg`, `--button-text`.

| | Ficha de Campo (`field`) | Diário Manuscrito (`journal`) |
|---|---|---|
| Estética | técnica, escura, moderna | pergaminho antigo / fantasia |
| Fundo | azul-marinho com brilho radial roxo | marrom com padrão SVG de quadradinhos dourados bem discretos, por cima do gradiente |
| Primária / acento | roxo `#8b5cf6` / ciano `#22d3ee` | bronze `#9a6a30` / dourado `#d4a15c` |
| Fonte | Segoe UI (sans-serif) | Georgia (serifada) |

### 7.2 Layout
- Container de até 1200px; grid de 12 colunas; painéis ocupam 6 colunas (dois por linha), diário ocupa a linha toda.
- Inventário: formulário em cima e lista embaixo, em qualquer largura (o painel tem no máximo ~550px, e duas colunas lado a lado não cabiam).
- Cartões com cantos arredondados, sombra e `backdrop-filter: blur` (efeito vidro).
- Botões sobem 1px no hover; barras animam a largura.

### 7.3 Responsividade
- **≤ 900px**: cada painel ocupa a largura toda.
- **≤ 640px**: topo em coluna; botões do topo em largura total; ficha, filtros e atributos em 1 coluna; dados em 2 colunas.

### 7.4 Outros
- Classe utilitária `.hidden` (`display: none !important`).
- `.empty-state` para listas vazias (borda tracejada).
- Barra de rolagem customizada (WebKit).
- Usa `color-mix()` no fundo do tema field, com fallback via `@supports` para navegadores sem suporte (cor já calculada `rgb(12, 18, 34)`).
- Fallbacks para navegadores antigos: `-webkit-backdrop-filter`, `top/right/bottom/left` antes de `inset`, valores fixos antes de `min()` e `clamp()`.
- O SVG de fundo é uma data URI codificada no padrão (`charset=utf-8`, `%3C`/`%3E`).

---

## 8. Requisitos do prompt × implementação

| Requisito (TEXTOS SCRIPT JOGO.txt) | Situação |
|---|---|
| HTML/CSS/JS separados, sem frameworks | ✅ Atendido |
| Persistência em `localStorage` | ✅ Atendido (com aviso e funcionamento em memória se o armazenamento estiver bloqueado) |
| Exportar/importar `.json` | ✅ Atendido |
| Nome, classe, nível, anotações editáveis | ✅ Atendido |
| Atributos editáveis | ✅ Atendido (salvos, limitados a 1–30 e incluídos no backup) |
| HP com barra e botões ±1/±5 | ✅ Atendido |
| Alerta de HP crítico (< 25% ou 0) | ✅ Atendido, com dois níveis (aviso e crítico) |
| Inventário: adicionar/editar/remover, nome/qtd/descrição | ✅ Atendido |
| Dados d4–d100 | ✅ Atendido |
| Histórico com timestamp | ✅ Atendido (12 últimas) |
| Diário com tags e filtro por tag/palavra-chave | ✅ Atendido |
| Alternância "Ficha de Campo" / "Diário Manuscrito" | ✅ Atendido (e também esconde painéis) |
| **Extras** não pedidos | Sanidade, Esforço, limpar histórico de dados, botão "Ocultar" atributos |

---

## 9. Pontos incompletos, inconsistências e riscos

Encontrados na análise do código original e nas revisões seguintes. Cada item está marcado como **✅ Resolvido** (com uma linha sobre como) ou **⏳ Pendente**.

### 9.1 Funcionalidades incompletas
1. ✅ **Atributos não estavam ligados ao JavaScript.** A tela sempre mostrava 10 e as alterações não eram salvas.
   *Resolvido:* `bindAttributeInputs` e `renderAttributes` ligam os campos ao `state.character.attributes`, com limite de 1 a 30; os valores entram no backup.
2. ✅ **O botão "Ocultar" atributos não fazia nada.**
   *Resolvido:* `bindAttributesToggle` alterna a classe `.hidden` na grade e o texto "Ocultar"/"Mostrar", e salva a preferência em `state.attributesHidden`.
3. ✅ **CSS sem uso** (`.attribute-name-row`, `.attribute-name-input`, `.remove-attribute-btn`, `.attributes-area`, `.add-attribute-btn`), restos de um recurso de atributos personalizados não terminado.
   *Resolvido:* as classes foram apagadas do `styles.css`.
   ✅ *Também resolvido:* o botão "Ocultar" ficava embaixo do título "Atributos", porque `.attributes-header` não tinha estilo. Agora `.attributes-header` entra na mesma regra de `.hp-header` (título à esquerda, controle à direita), sem cores, fontes ou tamanhos novos. Conferido nos dois temas, em 900px e 640px.
   ⏳ *Pendente:* `.attributes-section` continua sem estilo, então o cabeçalho "Atributos" fica colado na caixa "Esforço está estável.", sem o espaço e a linha que separam as barras (`.vital-bar-item`).
4. ⏳ **Diário sem edição/exclusão** de entradas.

### 9.2 Comportamentos estranhos
5. ✅ **Diminuir o máximo não ajustava o atual** ("24 / 10").
   *Resolvido:* no `change` do campo de máximo, o atual é reduzido para `≤ máximo`; `normalizeState` também garante isso nos dados carregados.
6. ✅ **O campo Nível virava "1" ao ser apagado**, e não havia limite de 99 no JS.
   *Resolvido:* o `input` só salva valores válidos sem reescrever o campo; o `change` aplica o limite de 1 a 99. A mesma correção vale para os campos de máximo.
7. ⏳ **Esconder painéis pelo tema** pode confundir: no modo padrão o diário não aparece. Ficou como está, por ser uma escolha de design.
8. ✅ **`journalList` não era declarado** no JS.
   *Resolvido:* declarado com `getElementById`, como os outros elementos.

### 9.3 Robustez do import e do armazenamento
9. ✅ **`normalizeState` não validava cada item** das listas; uma entrada de diário sem `tags` quebrava o filtro.
   *Resolvido:* cada item de `inventory`, `diceHistory` e `journal` é validado e os inválidos são descartados; `sanity`/`effort` nulos são recuperados; IDs e datas também são validados (ver 6.8).
10. ✅ **O `data-id` do inventário entrava sem escape.**
    *Resolvido:* agora passa por `escapeHtml`.
11. ✅ **Redundâncias**: `escapeAttribute` duplicava `escapeHtml`; `sanity`/`effort` nulos davam erro.
    *Resolvido:* `escapeAttribute` foi removido; as três barras são recuperadas pelo mesmo laço.
12. ✅ **Importar qualquer JSON válido (ex.: `{}`) apagava os dados**, trocando tudo pelo personagem de exemplo, e mostrava "sucesso".
    *Resolvido:* `looksLikeBackup` recusa arquivos sem `character` e sem nenhuma das listas; aparece "Arquivo inválido..." e nada muda.
    ✅ *Também resolvido:* um backup que tenha só parte dos dados (ex.: só `journal`) recebia os dados de exemplo no que faltava. Agora `normalizeState` completa com `emptyState` (valores neutros, ver 4.2); o exemplo aparece só no primeiro acesso.
13. ✅ **Remover o item em edição fazia perder o que estava sendo digitado.** O formulário ficava em modo edição e o "Salvar" não salvava nada.
    *Resolvido:* ao remover o item que está sendo editado, o formulário sai do modo de edição (`clearInventoryForm`).
    ✅ *Também resolvido:* importar um backup no meio de uma edição tinha o mesmo efeito. Agora, depois de uma importação bem-sucedida, o inventário sai do modo de edição e os formulários do inventário e do diário são limpos. Uma importação recusada não mexe em nada.
14. ✅ **Com o `localStorage` bloqueado ou cheio, o site travava.**
    *Resolvido:* leitura e gravação estão em `try/catch`; o site funciona só em memória e mostra um único `console.warn` sugerindo "Exportar Backup".
15. ✅ **"Última rolagem" mostrava uma rolagem antiga** depois de importar um backup sem histórico de dados, porque `renderDiceHistory` saía antes de atualizar o texto quando a lista estava vazia.
    *Resolvido:* com o histórico vazio, `renderDiceHistory` também mostra "Nenhuma".

### 9.4 Outros pendentes encontrados na revisão
16. ⏳ Com uma busca ou um filtro de tag ativo, uma entrada nova do diário pode não aparecer na lista, e parece que não foi salva.
17. ⏳ Tags com maiúsculas diferentes (`#combate` e `#Combate`) aparecem separadas no filtro, mas a busca por texto ignora maiúsculas.
18. ⏳ Quantidade, nível, atributos e máximos aceitam números decimais (ex.: 2,5).
19. ⏳ Com duas abas abertas, a última que salvar sobrescreve as mudanças da outra.
20. ⏳ O Exportar libera o link do download logo depois do clique, sem colocá-lo na página. Funciona nos navegadores atuais, mas pode falhar em antigos.

### 9.5 CSS e visual
21. ✅ **O SVG do fundo do tema Diário estava fora do padrão** (`;utf8`, `<`/`>` sem codificar, `fill="transparent"`).
    *Resolvido:* data URI recodificada; a comparação de pixels confirmou que o resultado é idêntico.
22. ✅ **O padrão SVG não aparecia**, porque ficava escondido embaixo do gradiente.
    *Resolvido:* a ordem das camadas foi invertida.
23. ✅ **Sem `color-mix()`, o fundo do tema field sumia** e a página ficava branca.
    *Resolvido:* fallback via `@supports` (ver 7.4), junto com outros fallbacks.
24. ✅ **O inventário transbordava o painel** em telas largas.
    *Resolvido:* formulário e lista empilhados (ver 7.2).

### 9.6 Detalhes
- No prompt, "estilo paminho" é um erro de digitação de "pergaminho".
- Os botões de vital (Sanidade/Esforço) também têm a classe `.hp-btn`; a separação é feita pelo `data-stat`, então funciona, mas os nomes de classe podem confundir.
- Mensagens de alerta usam `alert()` nativo.

---

## 10. Como executar e publicar

- **Local**: abrir `index.html` no navegador (Chrome, Edge, Firefox ou Safari recentes).
- **GitHub Pages**: https://professoralissonlucas.github.io/chronicles-sheet/ — publicado a partir da raiz da branch `main`. Não há build.
- **Resetar dados**: apagar a chave `chronicles-sheet-state-v1` no `localStorage` (DevTools → Application → Local Storage) ou importar um backup.
- **Armazenamento bloqueado** (algumas janelas anônimas ou configurações de privacidade): o site funciona, mas não guarda nada ao fechar. Use "Exportar Backup".

---

## 11. Glossário

| Termo | Significado |
|---|---|
| HP / PV | Pontos de Vida |
| Sanidade | Estabilidade mental do personagem |
| Esforço | Recurso gasto em ações especiais |
| FOR, DES, CON, INT, SAB, CAR | Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma |
| dX | Dado de X lados (d20 = dado de 20 lados) |
| Diário de Bordo | Registro narrativo da campanha |
