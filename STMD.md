# StudyMD (`.stmd`) — referência da sintaxe

StudyMD é o caderno do STDHub: **Markdown válido em qualquer editor**,
com açúcar de estudo que só o STDHub renderiza. Arquivo criado sem extensão
no Notebook já nasce `.stmd`. Todo `.stmd` **abre direto no caderno** (sem
Monaco/VSCode — só `.md` e código usam o editor clássico).

## Edição ao-vivo (estilo Obsidian)

O caderno **é** o editor: **clique num bloco para editar só ele** (o resto
continua renderizado). Sair do bloco (`blur`, `Ctrl+Enter`) grava;
`Escape` descarta. Nota nova abre com **título em cima e caixa de texto
embaixo** (grava os dois juntos; `Enter` no título pula para a caixa).

- **Toolbar estilo Google Docs**: com texto selecionado, Negrito/Título/etc.
  **aplicam na hora** (sem sintaxe na tela); sem seleção, o par é inserido
  e a digitação cai dentro dele. Sem bloco aberto, cria parágrafo novo no fim.
- **Botão direito no bloco**: só excluir e duplicar. No **vão entre blocos**
  (ou área vazia): criar título/subtítulo/texto **no meio** (entra exatamente
  ali, pré-preenchido e selecionado).
- **Botão direito digitando**: menu exclusivo — copiar, colar, selecionar
  tudo, **Excluir** (texto/linha) e **Deletar** (o bloco inteiro). A seleção
  sobrevive ao botão direito (estilo Google Docs).
- **Caneta** (toolbar): desenha **direto sobre a página** (cores,
  espessuras, limpar); Concluir anexa o desenho como imagem no fim,
  Cancelar descarta. A tinta é transparente — anota por cima do texto.
- **Interativos não abrem editor no clique**: tarefa alterna, flashcard
  **vira com 1 clique e edita com 2**, quiz responde/verifica, link abre.
- **Caixa de edição**: botão de salvar no canto inferior direito (grava e
  fecha); editor vazio mostra o tipo (`# ` → Título, `> ` → Citação…)
  ou *Lorem ipsum*.
- **Sidebar**: arraste o ícone (calculadora etc.) direto para um pin
  (esquerda/direita/embaixo) — abre já ancorado, sem abrir a aba antes.
- Arquivo sempre guarda texto cru portátil; quebras entre blocos e quebra
  final são normalizadas sozinhas.

Regra de ouro do ao-vivo: **sintaxe incompleta ou com o cursor dentro
aparece crua** (para digitar/editar); **completa e com o cursor fora,
vira visual** — no editor e no Caderno. O arquivo sempre guarda o texto
cru e portátil; o formato é só visual. Salvar não muda nada no conteúdo.

## Marcas em linha

| Sintaxe | Vira |
|---|---|
| `**negrito**`, `*itálico*`, `~~riscado~~`, `` `código` `` | formatação normal |
| `==marca-texto==` | destaque amarelo |
| `++sublinhado++` | sublinhado |
| `$x^2$` | matemática em linha (estilo próprio; KaTeX no futuro) |
| `[texto](https://...)`, `![alt](url)` | link / imagem |

Sem aninhamento na v1 (`**==x==**` não combina).

## `#stdcalc` — cálculo em linha

```text
#stdcalc 39 * 37 =
```

Mostra `39 * 37 = 1443`. Duas formas de fechar: `=` **no fim da linha**
ou a forma explícita (vale no meio da linha também):

```text
O total é #stdcalc 10/2 /stdcalc para cada um.
```

Raiz quadrada em qualquer escrita:

```text
#stdcalc sqrt(16) =
#stdcalc √25 =
#stdcalc raiz 36 =
#stdcalc raiz de 49 =
#stdcalc raiz quadrada de 81 =
```

Tudo da calculadora funciona: `+ - * / % ^`, parênteses, `sin cos tan`,
`sqrt log ln`. Erro de conta mostra `expressão = ?` (nunca some).

## `#stdmarker` — marcador

```text
#stdmarker texto importante /stdmarker texto normal
```

O trecho entre as marcas vira destaque; o resto segue normal. Exige o
fechamento `/stdmarker` **na mesma linha** — sem fechar, fica cru.

## Outras `#std`

O formato é `#stdfunc ... /stdfunc` (funções futuras entram aqui).
Função desconhecida **fica crua de propósito** (ex.: `#stdbogus x /stdbogus`).
Para escrever literal, escape com barra: `\#stdcalc 2+2 =`.

## Blocos `:::` (uma função por bloco, fecha com `:::`)

Flashcard (frente e verso separados por `---`; clica para virar):

```text
:::flashcard
Quanto é 2+2?
---
4
:::
```

Quiz (marca a(s) certa(s) com `[x]`; botão Verificar + placar):

```text
:::quiz
Capital do Brasil?
- [ ] São Paulo
- [x] Brasília
:::
```

Caixas (`dica`, `aviso`, `nota` ou nome próprio):

```text
:::dica
Revise os flashcards antes da prova.
:::
```

Bloco de contas (uma expressão por linha, cada uma com resultado):

````text
```calc
2*(3+4)
sqrt(16)
```
````

## Tarefas, tabelas e desenho

```text
- [ ] ler capítulo 3
- [x] resumo pronto
```

No Caderno, clicar na tarefa **escreve de volta no arquivo** (quiz nunca
escreve — é só resposta). Tabelas GitHub (`| A | B |`) renderizam normal.
Desenho à caneta (botão da toolbar): vira imagem PNG embutida
(`![desenho](data:...)`), legível em qualquer Markdown.

## Toolbar e comandos

A barra do `.stmd` tem 1 clique para cada módulo. Os botões de cálculo
rápido e marcador embrulham a seleção (`#stdcalc ... =`, `#stdmarker ...
/stdmarker`); com a seleção feita e o cursor fora, já colapsam no visual.
No texto, os mesmos blocos chegam pelos comandos `flash`, `quiz`, `calc`,
`dica`, `aviso`, `nota`, `task`, `hl`, `ul`, `math`, `table`.
