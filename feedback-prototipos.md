# STDHub — Feedback dos protótipos (T12/T13/T14 + settings de IA)

> Gerado em 2026-09-15 após implementar os 3 módulos funcionais.
> Objetivo: listar o que AJUDA e o que ATRAPALHA em cada mudança,
> para decidirmos juntos os próximos passos quando você voltar.

---

## 1. Calculadora (T12)

**Como testar:** sidebar → Calculadora (abre em nova tab) → digite ou clique.
Toggle `123`/`Scientific`, alternância DEG/RAD, histórico clicável, copiar
clicando no resultado ou no botão.

**O que AJUDA**
- 100% local e offline: zero custo, zero chave, zero rede. Nunca quebra.
- Engine própria com precedência, parênteses, `pi`/`e`, multiplicação
  implícita (`2pi`, `2(3+4)`), fatorial, trigonométricas + inversas,
  log/ln, raízes, `%` como módulo.
- Histórico persistido na máquina; copiar em 1 clique.

**O que ATRAPALHA / limita**
- `%` é **módulo**, não porcentagem (10% de 200 não funciona como esperado).
  Decidir: manter estilo programador ou virar porcentagem estilo celular?
- Sem modo programador (bin/hex), sem conversor de unidades, sem fita
  editável. Para estudos está ok; para dev, falta.
- Erros são genéricos ("Expressão inválida") — não diz ONDE errou.

**Decisões pendentes**
1. `%` = módulo ou porcentagem?
2. Quer modo programador / conversor no futuro ou mantém foco em estudos?

---

## 2. Pesquisa com resumo de IA (T13)

**Como testar:** Config → escolha busca (DuckDuckGo) e IA (Pollinations =
padrão sem chave) → sidebar → Pesquisa → busque. O resumo aparece acima
dos resultados.

**O que AJUDA**
- DuckDuckGo funciona **sem chave e sem conta**: resposta instantânea +
  tópicos relacionados + links (abrir/copiar).
- Brave como 2ª opção real (precisa de chave gratuita) — resultados web
  de verdade, não só instant answers.
- Resumo estilo AI Overview com citações `[n]` das fontes.

**O que ATRAPALHA / limita**
- DuckDuckGo Instant Answer **não é uma busca web completa**: para temas
  obscuros retorna pouco ou nada (só 10 itens, sem paginação).
- Resumo depende 100% da IA configurada: sem provedor válido, mostra o
  erro cru (`ai-unreachable`, `ai-http-401`...). Mensagens técnicas demais
  para usuário comum — precisam de tradução amigável.
- Sem context menu ainda (spec pedia abrir-em-tab/copiar-link via menu;
  hoje são botões — funciona, mas foge do padrão global).
- Sem histórico de pesquisas.

**Decisões pendentes**
1. Manter DDG gratuito-limitado ou exigir chave (Brave/Tavily) como padrão?
2. Tradução amigável dos erros de IA/pesquisa (obrigatório antes de release)?
3. Histórico de pesquisa local?

---

## 3. Chatbot Tutor (T14)

**Como testar:** Config → IA (Pollinations já vem pronto, sem chave) →
sidebar → Tutor → converse. Sessões à esquerda (nova, renomear ✏️,
excluir 🗑️). Botão direito NÃO usado — ações por ícone em cada mensagem.

**O que AJUDA**
- Funciona de graça out-of-the-box (Pollinations, sem chave).
- Sessões completas: criar/renomear/excluir/alternar, título automático,
  tudo no localStorage (offline p/ histórico).
- Por mensagem: copiar, reenviar/regenerar, **editar resposta da IA**,
  excluir própria, **salvar no Editor** (cria `.md` na pasta aberta).

**O que ATRAPALHA / limita**
- **Sem streaming**: a resposta só aparece quando termina (perguntas
  longas parecem "travadas" — só o "Pensando…" gira). Maior ponto fraco
  do protótipo.
- **Sem tools de agente** (o spec previa ler/criar arquivos e resumir
  pesquisa). Hoje é só conversa.
- **Salvar no Editor exige pasta aberta**; sem pasta, só avisa. Sem
  pasta, o fluxo morre aí.
- Excluir sessão é imediato, **sem confirmação** (perda acidental fácil).
- Histórico só local: sem exportar (Drive/GitHub) e sem sync (sem banco).
- Sem limite de contexto: conversas gigantes podem estourar o modelo
  (erro) ou a conta (custo). Sem contador de tokens.

**Decisões pendentes**
1. Streaming agora ou depois? (recomendo: agora, é o maior ganho de UX)
2. Confirmação ao excluir sessão/conversa?
3. Quais tools de agente primeiro: ler arquivos? criar? rodar pesquisa?
4. Exportar histórico (md/json) antes ou junto do banco?

---

## 4. Provedor de IA compartilhado (settings novas)

**Onde:** engrenagem (Config) → cartões "AI provider" e "Web search".
Presets: **Pollinations** (padrão, grátis, sem chave), OpenAI, OpenRouter,
DeepSeek, Groq, **Ollama local**, Custom (URL + modelo livres). Botão
**Testar conexão** responde na hora se funciona.

**O que AJUDA**
- Um lugar só configura IA do resumo + do chatbot (o que você pediu).
- Chaves antigas salvas migram sozinhas para os campos novos.
- Chaves ficam só no cofre local (arquivo escondido no desktop,
  localStorage na web) — nunca no repo.
- Botão de teste elimina adivinhação ("será que a chave funciona?").

**O que ATRAPALHA / limita — LEIA COM ATENÇÃO**
- **CORS no desktop/web**: o app chama as APIs direto do frontend.
  Funciona: Pollinations, OpenRouter, Groq, DeepSeek(?), Ollama (com
  `OLLAMA_ORIGINS` configurado). **OpenAI oficial BLOQUEIA browser por
  desenho** — com preset OpenAI o teste vai falhar por CORS mesmo com
  chave válida. Solução real: um micro-backend/proxy (Tauri command com
  HTTP) — meio dia de trabalho, recomendo antes do release.
- **Chaves em texto puro** no store local. Ok para protótipo em máquina
  pessoal; para release pensar em cofre do SO (keychain/credential mgr).
- Modelos padrão podem desatualizar (ex.: `llama-3.1-8b-instant` da Groq,
  `openrouter/auto`). O campo é editável de propósito.
- Ollama exige modelo baixado (`ollama pull llama3.1`) e, no desktop,
  `http://localhost` a partir do webview funciona; na web pura depende
  do navegador permitir.
- Sem controle de gasto: sem teto, sem contador, sem aviso. Com chave
  paga, um loop/resumo gigante gasta de verdade.

**Decisões pendentes**
1. Proxy Tauri p/ chamadas de IA (resolve CORS + esconde chave do bundle)?
2. Cofre do SO para chaves ou texto puro basta por enquanto?
3. Algum teto/aviso de custo?
4. Manter Pollinations como padrão (grátis, instável às vezes) ou pedir
   chave logo de cara?

---

## 5. Geral (vale p/ os 3 módulos)

- **Tudo em inglês + português**, testado nos dois.
- **Sem banco ainda** (T11b): histórico de chat e settings vivem só na
  máquina. Trocar de PC = perder conversas. Sync volta com a decisão
  do banco (SQL próprio vs Supabase).
- Cobertura: 167 testes unit + 3 e2e reais no Edge passando; `tauri build`
  refeito em 2026-09-15 (instaladores na pasta padrão). Nada foi commitado.
- `spec.md` §§5–7 continuam valendo; o que falta do spec: context menus
  da Pesquisa, export de histórico, sessões na nuvem, colaboração — tudo
  Fase 2 pós-feedback.

## Resumo do que eu recomendo (minha opinião)

1. **Streaming no chat** — maior salto de percepção de qualidade.
2. **Proxy Tauri p/ IA** — resolve CORS do OpenAI e prepara cofre de chaves.
3. **Confirmação ao excluir** sessão (2 linhas, evita perda).
4. **Erros amigáveis** (trocar `ai-http-401` por "chave inválida, confira…").
5. Depois: tools de agente (ler arquivo → resumir → salvar) e decisão do banco.
