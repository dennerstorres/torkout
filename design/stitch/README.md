# Referências do Google Stitch

Artefatos de referência do projeto **Torkout: Redesign Premium PWA**.

- Project ID: `1584552474848988642`
- Uso: orientar a Fase 14 do `PLAN.md`.
- Natureza: especificação visual; estes arquivos não fazem parte do bundle da aplicação.

## Telas

| Tela                             | Screen ID                                            | Arquivo local                      |
| -------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| Design System                    | `asset-stub-assets_c3e210319ef64392be3d38c1586d0ff4` | documentado abaixo                 |
| Hoje — Mobile                    | `21f96bae8d7140189551c4d15d2b6e54`                   | `hoje-mobile.html`                 |
| Planejamento — Desktop           | `37ace8165a134166886d7aaf65da1e6a`                   | `planejamento-desktop.html`        |
| Treino em Execução — Mobile      | `2cc224069c2345ae9688119ba87e80cb`                   | `treino-em-execucao-mobile.html`   |
| Histórico — Desktop              | `4a5d14c6ef96447b887ea8e124f5b400`                   | `historico-desktop.html`           |
| Progresso — Desktop              | `f95f11ecc1064ebdbb758bcde24dd82d`                   | `progresso-desktop.html`           |
| Sugestões de Progressão — Mobile | `cf647036d5254d85bc426ec37c0502a1`                   | `sugestoes-progressao-mobile.html` |
| Conta — Mobile                   | `ac86b08a762346e5bc909cd5aee378f4`                   | `conta-mobile.html`                |

`overview.png` é uma captura geral do canvas. O Stitch não permitiu gerar automaticamente uma
captura PNG individual a partir dos HTMLs extraídos.

## Design system extraído

- Nome: High-Performance Kinetic System.
- Primária: `#d4ff00`.
- Secundária: `#7000ff`.
- Terciária/destrutiva: `#ff4d4d`.
- Headline: Geist.
- Corpo: Inter.
- Superfícies principais: `#0e0e0e`, `#131313`, `#1c1b1b`, `#201f1f`, `#353534`.

## Regras de uso

- Não copiar scripts de edição do Stitch para `apps/web`.
- Não usar o Tailwind CDN presente nos HTMLs.
- Não criar dependência de Google Fonts ou Material Symbols em runtime.
- Traduzir a referência para tokens CSS, componentes React e assets locais.
- Preservar como fonte de verdade funcional o `SPEC.md`, os contratos e os testes do projeto.
