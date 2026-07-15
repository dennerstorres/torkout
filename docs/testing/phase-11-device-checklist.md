# Fase 11 — Checklist de dispositivos e acessibilidade

**Status:** diferido para o gate de lançamento da Fase 13 por autorização do titular em 15/07/2026

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

**Aparelho:** a preencher  
**iOS:** a preencher  
**Safari:** a preencher  
**Data:** a preencher  
**Responsável:** a preencher

- [ ] Instalar por Compartilhar → Adicionar à Tela de Início.
- [ ] Abrir em `standalone` e confirmar nome, ícone, cores e safe areas.
- [ ] Autenticar online e abrir a jornada Hoje.
- [ ] Desligar a rede, recarregar e registrar uma edição na jornada Hoje.
- [ ] Fechar e retomar o aplicativo; confirmar rascunho, registro local e outbox.
- [ ] Reconectar e confirmar sincronização sem duplicação.
- [ ] Abrir teclado em todos os campos da jornada; foco e ação não ficam encobertos.
- [ ] Aumentar texto, ativar VoiceOver e redução de movimento; concluir a jornada por leitor.
- [ ] Instalar uma atualização; confirmar que ela aguarda ação e não interrompe formulário.

**Resultado/evidência:** a preencher

## Android físico — obrigatório

**Aparelho:** a preencher  
**Android:** a preencher  
**Chrome:** a preencher  
**Data:** a preencher  
**Responsável:** a preencher

- [ ] Instalar pelo prompt/menu do Chrome.
- [ ] Abrir em `standalone` e confirmar nome, ícone, cores, orientação e safe areas.
- [ ] Autenticar, registrar na jornada Hoje offline, retomar e sincronizar.
- [ ] Confirmar teclado, foco visível, TalkBack, texto ampliado e alvos de toque.
- [ ] Instalar atualização sem perder formulário ou alteração pendente.

**Resultado/evidência:** a preencher

## Desktop físico — obrigatório

**Sistema:** a preencher  
**Navegador/versão:** a preencher  
**Data:** a preencher  
**Responsável:** a preencher

- [ ] Instalar pela barra de endereço no Chrome ou Edge.
- [ ] Abrir como aplicativo e retomar após fechar a janela.
- [ ] Percorrer autenticação, página inicial e Hoje somente por teclado.
- [ ] Confirmar ordem de foco, foco visível, zoom de 200% e modo de alto contraste.

**Resultado/evidência:** a preencher

## Critério de fechamento

O commit da Fase 11 foi autorizado pelo titular sem esta validação por indisponibilidade atual de
aparelhos. O lançamento da Fase 13 permanece bloqueado enquanto qualquer item físico obrigatório
estiver sem evidência ou falhar. Achados recebem teste de regressão antes da correção.
