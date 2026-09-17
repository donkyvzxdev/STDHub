\# STDHub - Spec v1.1

> Fase 1 (agora): shell + Editor + Configurações. Fase 2 (depois): Calculadora, Pesquisa, Chatbot.
> Regra permanente (§11): só avança de task com teste 100% sem erros + revisão de segurança.
> Idioma: inglês por padrão; detecta região/idioma na entrada, trocável no Config; no cadastro ou na primeira entrada como guest, a primeira pergunta é o idioma (só na primeira vez).

\## 1. Visão
Um usuario tem dois modos, o local (guest), e o usuario cadastrado, o guest consegue entrar no aplicativo, usar as funções ja incluidas no aplicativo (como editor de texto, calculadora, pesquisa, chatbot e configurações), ele não consegue salvar estes arquivos no servidor do STDHub, mas, consegue salvar-los na propia maquina ou direto no GitHub ou alguma plataforma do tipo (tipo google drive).
Na Fase 1 valem Editor e Configurações; Calculadora, Pesquisa e Chatbot têm só ícone + tela coming soon e viram funcionais na Fase 2.

\## 2. Perfis (Guest vs Logado)
Guest tem uma experiencia local + "configure yourself": usa tudo localmente e, quando quiser, configura as proprias chaves de API (pesquisa/IA) nas Configurações. Não salva na nuvem do STDHub, mas salva na propia maquina, no GitHub (cria um repositorio ou adiciona arquivos num repositorio propio) ou no Google Drive (cria uma pasta ou envia para uma pasta que escolher). Criando conta depois, migra sem perder os arquivos locais.
Logado tem tudo do guest e ainda salva/sincroniza na nuvem do STDHub (servidor propio, banco a definir: SQL próprio ou Supabase).
Primeira abertura do app: tela de login (Entrar / Criar conta / Continuar como convidado) que leva direto para a plataforma. O cadastro é uma tela interativa em passos e a primeira pergunta é sempre o idioma da pessoa. Quem entra como guest também escolhe o idioma na primeira vez que entra como guest (só nessa primeira vez); depois disso o app lembra a escolha e não pergunta de novo. Na entrada, o app tenta descobrir a região/idioma do usuário (locale do SO/navegador) e sugere o idioma, mas quem decide é o usuário; a troca fica disponível a qualquer momento nas Configurações.

\## 3. Sidebar e Navegação
Uma sidebar na lateral esquerda, com um tamanho bom na horizontal e que não seja desconfortavel, e que seja possivel clicar facilmente nos icons. Clicar numa função abre (ou foca) sua aba direto — sem precisar de botão direito. Só o Editor tem painel secundário à direita da sidebar (o explorador); as demais funções não têm painel. As sidebars são móveis (redimensionar/arrastar). Abas de função (Calculadora, Pesquisa, Chatbot) podem ser ancoradas à direita (arrastar/menu "Ancorar à direita"), à esquerda (entre o explorador e o conteúdo, ou no lugar do explorador quando ele está oculto) ou embaixo (acima do terminal; o terminal continua abrindo abaixo do dock) para uso lado a lado; "Mover para a área principal" traz de volta. Cada lado mantém sua própria aba visível e é redimensionável arrastando a borda (tamanho persiste). Focar uma aba ancorada nunca esvazia o centro: ele mantém o Notebook ou a última aba da área principal. Configurações abre só o modal, sem selecionar nada. Sistema de tabs também para o editor (fechar, fechar outras/todas, mover, copiar caminho).
Ícones fixos (nesta ordem): Editor, Calculadora, Pesquisa, Chatbot, Configurações. Os 3 da Fase 2 aparecem normalmente, mas abrem uma tela coming soon (nome, descrição curta, aviso "disponível na Fase 2", sem nenhuma ação funcional).
No topo do aplicativo há uma menubar (componente menubar do shadcn) com menus File (abrir pasta de origem, salvar mudanças...), Edit, View e Settings (atalho para as Configurações), com atalhos de teclado visíveis; outros itens entram no futuro.

\## 4. US-EDITOR-01 (Fase 1)
Um editor simples, o usuario abre ele, e na direita da sidebar esquerda, aparece um explorador estilo vscode, aonde ele pergunta se você quer logar com o GitHub, o google drive, ou fazer localmente (caso o usuario esteja logado, sera possivel fazer o salvamento no servidor do STDHub), e quando o usuario coloca a pasta, ele mostra a estrutura das pastas, e os arquivos dentro delas, cada arquivo (como por exemplo, um .md, um .js, um .ts) tem o seu propio icone, e sua propia sintaxe, faça um preencher automatico de acordo com a sintaxe igual ao do vscode, e que seja possivel, tambem, no futuro, implementar funções propias do STDHub para este preencher automatic, e sera possivel rodar o explorer para ver a esturura, e do lado do icone do explorer, tera um botão pequeno de uma setinha para cima, aonde sera possivel abrir tambem o terminal na pasta (só no Tauri na Fase 1), ou no futuro, caso eu decida, rodar o executavel com algo tipo um GCC, Python Loader e etc. Botão direito no explorador abre context menu estilo VSCode (novo arquivo/pasta, renomear, excluir com confirmação, duplicar, copiar caminho, revelar no sistema — Tauri); nas tabs do editor e nas tabs de funções: fechar, fechar outras/todas e copiar caminho. O context menu é padrão global do app: na Fase 2, Pesquisa (abrir resultado em nova tab, copiar link/resumo) e Chatbot (copiar mensagem, reenviar, salvar como arquivo no Editor) usam o mesmo padrão, e futuras funções também.

\## 5. US-CALC-01 (FASE 2 — na Fase 1: só ícone + tela coming soon)
Uma calculadora simples com toggle cientifico, consegue copiar um valor com um botão ao lado ou clicando no valor na calculadora (o valor do resultado).

\## 6. US-SEARCH-01 (FASE 2 — na Fase 1: só ícone + tela coming soon)
Utilize a API do DuckDuckGO, com resumo de IA estilo o da Google. Provedor de resumo definido na Fase 2.

\## 7. US-CHAT-01 (FASE 2 — na Fase 1: só ícone + tela coming soon)
Chatbot simples para estudantes/pessoas colocando conteudo em pratica, com funções de agente no modo local (ler/criar arquivos do editor, resumir pesquisa). Utilize uma chave de IA gratis (provedor gratuito definido na Fase 2; chave via `.env`, nunca neste arquivo). Sistema de sessões/conversas (criar, renomear, excluir, alternar; histórico local com exportação para provedores de nuvem como Google Drive e GitHub e, para logados, sync na nuvem STDHub). Context menu nas mensagens: editar a mensagem da IA, excluir a própria mensagem, copiar, reenviar e salvar no Editor.

\## 8. US-CONFIG-01 (Fase 1)
Um tema simples, escuro, estilo do website shadcn (padrão). Botões e demais componentes são copiados do shadcn para dentro do projeto (código-fonte próprio) e seguem o tema via variáveis CSS/tokens semânticos, então qualquer tema que o usuário escolher ou criar se aplica automaticamente a todos os componentes. Configurar cores de tema, densidade/design, trocar API de pesquisa e API do chatbot/pesquisa de IA, e outras opções no futuro, incluindo o idioma do aplicativo (inglês por padrão). As Configurações são salvas localmente num arquivo escondido no PC (pasta de dados do app) e, para logados, também na nuvem junto ao cadastro (banco a definir); vale local-first com sync pelo mais recente. Chaves via `.env` (`STDHUB_CHATBOT_API_KEY`) ou cofre local — nunca colar chave neste arquivo nem commitar `.env`.

\## 9. Regras Local vs Nuvem
No modo local (especialmente no guest) o usuario apenas consegue salvar no local (seu computador), ja na nuvem, caso o usuario seja um guest, querendo salvar na nuvem, sera possivel salvar usando o GitHub (cria um repositorio ou adiciona arquivos para um repositorio para o propio usuario) ou enviar para o google drive (crie uma pasta no google drive com os arquivos ou envie os arquivos para um pasta que o usuario escolha), mas, caso ele esteja logado, sera possivel alem dessas opções, tambem salvar na nuvem do STDHub (servidor propio do STDHub). As Configurações seguem a mesma regra (arquivo escondido local + cópia na conta, §8)..
OAuth do GitHub/Drive e wiring da nuvem (banco a definir): implementação na fase correspondente (ver plan.md); na Fase 1, origem local funciona 100% offline.

\## 10. Não-escopo (Fase 1)
Calculadora funcional (Fase 2 — Fase 1 só coming soon)
Pesquisa funcional (Fase 2 — Fase 1 só coming soon)
Chatbot funcional (Fase 2 — Fase 1 só coming soon)
Plugins
Pagamentos/Plano Pro
Suporte a Python/terminal completo no Editor web (só no Tauri, se for)
Colaboração realtime multi-usuário
Plugin da plataforma Onlybarber e do chatbot Kazer (projetos meu e de meus colegas, que iremos completar no futuro)

\## 11. Processo e critério de aceite (regra permanente)
Só passa para a proxima task depois de: testar a task atual, funcionar 100% sem erros e passar revisão de segurança (sem chaves/segredos no código ou no repo, sem comandos destrutivos, dependências verificadas, sem expor dados do usuário). Execução estritamente sequencial pelo task.md, uma task por vez. Toda task entrega: código + como foi testado + riscos verificados.
