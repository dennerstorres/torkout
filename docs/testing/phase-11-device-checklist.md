# Fase 11 — Checklist de dispositivos e acessibilidade

**Status:** concluído por validação manual do titular em aparelhos físicos em 16/07/2026

Este registro deve ser preenchido sem dados pessoais reais. Cada execução informa aparelho,
versão do sistema, navegador, data e resultado. Emulação e testes automatizados são evidência
complementar, não substituem os aparelhos físicos exigidos pelo `SPEC.md`.

## Evidência automatizada

- [x] `pnpm test` verde: 30 arquivos e 91 testes.
- [x] `pnpm test:e2e` verde: 14 jornadas, incluindo manifesto, app shell offline e Axe/WCAG AA.
- [x] Manifesto validado com ícones `192x192`, `512x512`, `maskable` e Apple touch icon.
- [x] Atualização disponível mantém formulário aberto e só ativa após ação explícita.
- [x] Viewport automatizado Pixel 7 cobre Android mobile sem substituir aparelho físico.

## iPhone físico — obrigatório

- **Aparelho:** iPhone físico; modelo não registrado
- **iOS:** versão não registrada
- **Safari:** versão não registrada
- **Data:** 16/07/2026
- **Responsável:** titular do produto

- [x] Instalar por Compartilhar → Adicionar à Tela de Início.
- [x] Abrir em `standalone` e confirmar nome, ícone, cores e safe areas.
- [x] Autenticar online e abrir a jornada Hoje.
- [x] Desligar a rede, recarregar e registrar uma edição na jornada Hoje.
- [x] Fechar e retomar o aplicativo; confirmar rascunho, registro local e outbox.
- [x] Reconectar e confirmar sincronização sem duplicação.
- [x] Abrir teclado em todos os campos da jornada; foco e ação não ficam encobertos.
- [x] Aumentar texto, ativar VoiceOver e redução de movimento; concluir a jornada por leitor.
- [x] Instalar uma atualização; confirmar que ela aguarda ação e não interrompe formulário.

**Resultado/evidência:** aprovado em aparelho físico conforme confirmação direta do titular. Modelo,
versões e captura não foram registrados; a evidência é a declaração manual de 16/07/2026.

## Android físico — obrigatório

**Aparelho:** a preencher

- **Android:** aparelho e versão não registrados
- **Chrome:** versão não registrada
- **Data:** 16/07/2026
- **Responsável:** titular do produto

- [x] Instalar pelo prompt/menu do Chrome.
- [x] Abrir em `standalone` e confirmar nome, ícone, cores, orientação e safe areas.
- [x] Autenticar, registrar na jornada Hoje offline, retomar e sincronizar.
- [x] Confirmar teclado, foco visível, TalkBack, texto ampliado e alvos de toque.
- [x] Instalar atualização sem perder formulário ou alteração pendente.

**Resultado/evidência:** aprovado em aparelho físico conforme confirmação direta do titular. Modelo,
versões e captura não foram registrados; a evidência é a declaração manual de 16/07/2026.

## Desktop físico — obrigatório

- **Sistema:** desktop físico; sistema e versão não registrados
- **Navegador/versão:** navegador Chromium; versão não registrada
- **Data:** 16/07/2026
- **Responsável:** titular do produto

- [x] Instalar pela barra de endereço no Chrome ou Edge.
- [x] Abrir como aplicativo e retomar após fechar a janela.
- [x] Percorrer autenticação, página inicial e Hoje somente por teclado.
- [x] Confirmar ordem de foco, foco visível, zoom de 200% e modo de alto contraste.

**Resultado/evidência:** aprovado em desktop físico conforme confirmação direta do titular. Sistema,
versões e captura não foram registrados; a evidência é a declaração manual de 16/07/2026.

## Critério de fechamento

O commit da Fase 11 havia sido autorizado sem esta validação. Em 16/07/2026, o titular confirmou a
execução e aprovação do checklist em iPhone, Android e desktop físicos, encerrando o gate AC-09.
Achados futuros recebem teste de regressão antes da correção.
