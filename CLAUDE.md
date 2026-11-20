# CLAUDE.md — Chronicles & Sheet

Regras que valem para **todas** as tarefas neste projeto. A descrição completa do projeto, do estado salvo e dos problemas conhecidos está em [SPEC.md](SPEC.md). Leia esse arquivo antes de mexer no código.

## Tecnologia

- Projeto estático para **GitHub Pages**: só `index.html`, `styles.css` e `script.js`.
- HTML + CSS + JavaScript puro. **Sem frameworks, sem build, sem dependências externas** (nada de npm, CDN, bibliotecas ou fontes externas).
- Tem que funcionar abrindo o `index.html` direto no navegador.

## Visual: não alterar

- Cores, fontes, espaçamentos, layout e textos visíveis continuam **exatamente iguais**.
- Isso inclui as variáveis CSS dos dois temas (`:root` e `body[data-theme='journal']`) e as mensagens mostradas na tela.
- **Única exceção:** consertar SVGs quebrados (por exemplo, o padrão de fundo em `data:image/svg+xml` do tema `journal` em `styles.css`), sem mudar a aparência que eles deveriam ter.

## Dados e compatibilidade

- A chave do `localStorage` continua sendo **`chronicles-sheet-state-v1`**.
- Backups `.json` já exportados precisam continuar sendo importados sem erro e sem perder dados.
- Não renomear nem remover campos do `state` (`theme`, `character`, `inventory`, `diceHistory`, `journal` e seus subcampos). Campos novos só podem ser adicionados se também receberem valor em `defaultState` (exemplo do primeiro acesso), em `emptyState` (valor neutro usado para completar dados que faltam) e, se precisarem de validação, em `normalizeState`, para que backups antigos continuem funcionando.

## Estilo de código

- Código, nomes novos e comentários em **português**, seguindo o estilo do código atual:
  - funções `bindX()` registram eventos e funções `renderX()` desenham a tela;
  - o fluxo é sempre: evento → altera `state` → `saveState()` → render da área afetada;
  - `const`, arrow functions, aspas simples, ponto e vírgula, indentação de 2 espaços;
  - todo texto do usuário inserido via `innerHTML` passa por `escapeHtml`.

## Preservar o trabalho das alunas

- O projeto foi feito por alunas. **Corrigir, não reescrever.**
- Manter a estrutura dos arquivos, a ordem das funções, os nomes, os IDs e as classes existentes sempre que possível.
- Fazer a menor mudança que resolve o problema. Não refatorar, reorganizar ou "modernizar" código que já funciona.
- Se uma correção exigir mudança maior, explicar o motivo antes de fazer.
