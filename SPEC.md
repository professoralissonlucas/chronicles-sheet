# SPEC — Chronicles & Sheet

> Especificação descritiva do projeto **como ele está hoje**. Este documento só analisa; nenhum arquivo do projeto foi alterado.

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
├── styles.css               (716 linhas)  Visual, temas e responsividade
├── script.js                (674 linhas)  Estado, lógica, eventos e renderização
└── TEXTOS SCRIPT JOGO.txt   ( 43 linhas)  Prompt/requisitos originais do projeto
```

Não existe `package.json`, pasta de assets, testes nem controle de versão (a pasta não é um repositório git). Para rodar, basta abrir `index.html` no navegador.

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
| Atributos | `.attribute[data-attribute="forca"...]` | FOR, DES, CON, INT, SAB, CAR — número `1–30`, padrão 10 |
| Ocultar atributos | `#toggleAttributesBtn` | botão "Ocultar" |

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

Personagem de exemplo **Aelric Vale**, Bárbaro nível 3, HP 24/30, Sanidade 12/20, Esforço 4/8, atributos 16/12/15/9/11/10; inventário com "Poção de cura" ×2 e "Mapa antigo" ×1; uma rolagem `d20 = 15`; uma entrada de diário "Primeira entrada" com `#Combate` e `#Quest`. A intenção é a página nunca abrir vazia e já demonstrar cada recurso.

### 4.2 IDs

`generateId()` usa `crypto.randomUUID()` quando disponível; senão monta `id-<timestamp>-<aleatório hex>`.

---

## 5. Fluxo da aplicação

```
carrega script.js (no fim do <body>)
  └─ state = loadState()
        ├─ não há nada salvo → cópia de defaultState
        ├─ há JSON válido     → normalizeState(JSON salvo)
        └─ JSON corrompido    → aviso no console + defaultState
  └─ init()
        ├─ bind* (registra todos os eventos)
        └─ renderAll()
```

Padrão usado em toda a aplicação — **evento → altera `state` → `saveState()` → render da área afetada**:

| Função de render | O que desenha |
|---|---|
| `renderTheme` | `data-theme` do body e texto do botão de tema |
| `renderCharacterBlock` | nome, classe, nível, anotações |
| `renderHp` / `renderSanity` / `renderEffort` | largura da barra, número atual, máximo, mensagem de status |
| `renderInventory` | lista de itens + liga os botões Editar/Remover |
| `renderDiceHistory` | histórico + "Última rolagem" |
| `renderJournal` | reconstrói o `<select>` de tags, aplica filtros e desenha as entradas |

Não há framework reativo: o redesenho é manual, por bloco, geralmente limpando `innerHTML` e recriando a lista.

---

## 6. Regras de negócio por funcionalidade

### 6.1 Ficha
- Nome, classe e anotações são salvos a cada tecla (`input`).
- Nível: `Number(valor) || 1` — campo vazio ou inválido vira 1.

### 6.2 Barras vitais (HP, Sanidade, Esforço)
- Botões somam/subtraem e o resultado é limitado a `0 ≤ atual ≤ máximo`.
- Alterar o máximo: `max(1, valor)`.
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
- **Remover**: imediato, sem confirmação.
- Lista vazia mostra: "Nenhum item no inventário. Adicione o primeiro item."

### 6.4 Rolador de dados
- `Math.floor(Math.random() * lados) + 1`.
- Resultado no formato `"d20 = 15"` com timestamp; entra no topo; o histórico guarda **as 12 últimas**.
- Datas no formato curto `pt-BR` (`Intl.DateTimeFormat`, ex.: `20/11/2026 14:32`).
- "Limpar histórico" esvazia a lista e volta "Última rolagem" para "Nenhuma".

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
- **Importar**: lê o arquivo, faz `JSON.parse`, passa por `normalizeState`, substitui o estado, salva, redesenha tudo e mostra `alert` de sucesso. Em erro: `alert` "Arquivo inválido...". O input é limpo no final, para permitir importar o mesmo arquivo de novo.

### 6.8 Normalização e segurança
- `normalizeState` faz *deep merge* do JSON recebido sobre uma cópia do estado padrão: chaves que faltam são completadas; arrays recebidos substituem os padrões; tema inválido volta para `field`; atributos ausentes são restaurados.
- `escapeHtml` é usado em todo texto do usuário inserido via `innerHTML` (nomes, descrições, tags, títulos, conteúdo), evitando injeção de HTML.

---

## 7. Estilo e temas (styles.css)

### 7.1 Sistema de variáveis
Todas as cores vêm de variáveis em `:root` (tema **field**), redefinidas em `body[data-theme='journal']`. Principais tokens: `--bg`, `--panel`, `--primary`, `--accent`, `--text`, `--muted`, `--danger`, `--success`, `--warning`, `--border`, `--hp-fill`, `--input-bg`, `--button-text`.

| | Ficha de Campo (`field`) | Diário Manuscrito (`journal`) |
|---|---|---|
| Estética | técnica, escura, moderna | pergaminho antigo / fantasia |
| Fundo | azul-marinho com brilho radial roxo | marrom com padrão SVG sutil embutido |
| Primária / acento | roxo `#8b5cf6` / ciano `#22d3ee` | bronze `#9a6a30` / dourado `#d4a15c` |
| Fonte | Segoe UI (sans-serif) | Georgia (serifada) |

### 7.2 Layout
- Container de até 1200px; grid de 12 colunas; painéis ocupam 6 colunas (dois por linha), diário ocupa a linha toda.
- Cartões com cantos arredondados, sombra e `backdrop-filter: blur` (efeito vidro).
- Botões sobem 1px no hover; barras animam a largura.

### 7.3 Responsividade
- **≤ 900px**: cada painel ocupa a largura toda; inventário empilha formulário e lista.
- **≤ 640px**: topo em coluna; botões do topo em largura total; ficha, filtros e atributos em 1 coluna; dados em 2 colunas.

### 7.4 Outros
- Classe utilitária `.hidden` (`display: none !important`).
- `.empty-state` para listas vazias (borda tracejada).
- Barra de rolagem customizada (WebKit).
- Usa `color-mix()` no fundo, o que exige navegador recente.

---

## 8. Requisitos do prompt × implementação

| Requisito (TEXTOS SCRIPT JOGO.txt) | Situação |
|---|---|
| HTML/CSS/JS separados, sem frameworks | ✅ Atendido |
| Persistência em `localStorage` | ✅ Atendido (exceto atributos, ver §9) |
| Exportar/importar `.json` | ✅ Atendido |
| Nome, classe, nível, anotações editáveis | ✅ Atendido |
| Atributos editáveis | ⚠️ Editáveis na tela, mas **não salvos** (ver §9) |
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

Encontrados na análise. **Nenhum foi corrigido**; ficam registrados para decisão futura.

### 9.1 Funcionalidades incompletas
1. **Atributos não estão ligados ao JavaScript.** Os inputs FOR/DES/CON/INT/SAB/CAR não têm eventos nem render. Resultado: a tela sempre mostra 10 (valor do HTML), ignora os valores do estado (16, 12, 15...), e alterações **não são salvas** nem entram no backup.
2. **Botão "Ocultar" atributos (`#toggleAttributesBtn`) não faz nada**: não tem handler no JS.
3. **CSS sem uso**: `.attribute-name-row`, `.attribute-name-input`, `.remove-attribute-btn`, `.attributes-area`, `.add-attribute-btn` não correspondem a nenhum elemento. Indicam um recurso planejado de **atributos personalizados** (adicionar/renomear/remover) que foi abandonado ou não terminado. Já `.attributes-section` e `.attributes-header` são usados no HTML mas não têm estilo.
4. **Diário sem edição/exclusão** de entradas.

### 9.2 Comportamentos estranhos
5. **Diminuir o máximo não ajusta o atual**: com HP 24/30, mudar o máximo para 10 deixa "24 / 10" (a barra fica em 100%). Vale para as três barras.
6. **Campo Nível ao apagar**: como cada tecla chama `Number(v) || 1` e redesenha o campo, apagar o número para digitar outro faz aparecer "1" na hora. Também não há limite de 99 no JS (só no HTML).
7. **Esconder painéis pelo tema** pode confundir: no modo padrão o diário não aparece, e o usuário pode achar que ele não existe.
8. **`journalList` não é declarado** no JS; funciona só porque o navegador cria variáveis globais para elementos com `id`. É frágil.

### 9.3 Robustez do import
9. `normalizeState` valida a estrutura geral, mas **não valida cada item** das listas. Um backup com entrada de diário sem `tags` quebra o filtro (`entry.tags.some`).
10. O `id` dos itens do inventário entra em `data-id="..."` **sem escape**. Um backup `.json` manipulado poderia injetar HTML. Risco baixo (exige importar arquivo malicioso), mas é a única brecha no padrão de `escapeHtml`.
11. Pequenas redundâncias: `escapeAttribute` repete o que `escapeHtml` já faz; `normalizeState` recupera `hp` se vier `null`, mas não faz o mesmo com `sanity` e `effort` (se vierem `null`, os botões dessas barras dão erro).

### 9.4 Detalhes
- No prompt, "estilo paminho" é um erro de digitação de "pergaminho".
- Os botões de vital (Sanidade/Esforço) também têm a classe `.hp-btn`; a separação é feita pelo `data-stat`, então funciona, mas os nomes de classe podem confundir.
- Mensagens de alerta usam `alert()` nativo.

---

## 10. Como executar e publicar

- **Local**: abrir `index.html` no navegador (Chrome, Edge, Firefox ou Safari recentes).
- **GitHub Pages**: subir os três arquivos para a raiz do repositório e ativar Pages na branch principal. Não há build.
- **Resetar dados**: apagar a chave `chronicles-sheet-state-v1` no `localStorage` (DevTools → Application → Local Storage) ou importar um backup.

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
