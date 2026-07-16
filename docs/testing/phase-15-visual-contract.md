# Fase 15 — contrato visual e wireframes de baixa fidelidade

Status: proposta aprovável. Este documento orienta implementação, mas não registra aceite humano.

## Orçamentos verificáveis

| Propriedade         | Contrato                                                                                |
| ------------------- | --------------------------------------------------------------------------------------- |
| Overflow horizontal | zero em 320, 360, 390 e 430 px e com zoom de 200%                                       |
| Layout shift        | CLS de rota/carga assíncrona ≤ 0,05; nenhuma troca desloca o `h1` para fora da viewport |
| Alvo interativo     | mínimo 44 × 44 CSS px; espaçamento mínimo de 8 px entre ações concorrentes              |
| Ritmo interno       | label → controle 8 px; campo → campo e `h2` → conteúdo/divisor 16 px; nunca 0 px        |
| Contraste           | WCAG 2.2 AA: 4,5:1 para texto normal e 3:1 para texto grande/controles                  |
| Largura de leitura  | texto explicativo até 65 caracteres por linha, independente do container da feature     |
| Conteúdo            | área autenticada preenche o outlet após a sidebar; texto explicativo continua em 65ch   |
| Camadas             | base, sticky, navigation, popover e dialog; sem valores avulsos fora dos tokens         |
| Movimento           | 120–200 ms para feedback local; zero deslocamento não essencial com reduced motion      |
| Navegação           | destino ativo, `h1`, conteúdo e foco mudam no mesmo commit React                        |
| Barra mobile        | último controle permanece totalmente visível acima da safe area e da navegação          |

## Hierarquia e densidade

| Área         | Superfície dominante | Densidade mobile              | Densidade desktop                            | Ação principal           |
| ------------ | -------------------- | ----------------------------- | -------------------------------------------- | ------------------------ |
| Hoje         | próximo treino       | compacta, uma coluna          | resumo + fluxo principal, sem alturas iguais | iniciar/continuar treino |
| Planejamento | etapa em edição      | uma decisão por tela          | mestre/detalhe                               | salvar mudança futura    |
| Histórico    | calendário/mês       | calendário seguido do detalhe | calendário + detalhe proporcional            | selecionar/editar dia    |
| Progresso    | resultado do período | KPIs e narrativa sequencial   | toolbar + grupos analíticos                  | mudar período            |
| Conta        | perfil e dados       | seções sequenciais            | seções largas com texto limitado             | salvar seção ativa       |

## Matriz responsiva

| Faixa        | Shell                                | Conteúdo                                                    | Formulários e ações                                      |
| ------------ | ------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| 320–430 px   | header compacto + nav inferior       | uma coluna; 16 px laterais                                  | campos empilhados; ação principal alcançável com polegar |
| 431–767 px   | mesmo shell mobile                   | uma coluna confortável; 20 px laterais                      | pares curtos somente quando não houver truncamento       |
| 768–1023 px  | rail/sidebar compacta após validação | mestre/detalhe quando cada painel mantiver ≥ 320 px         | ações agrupadas por seção                                |
| 1024–1599 px | sidebar proporcional e header baixo  | toda a largura útil do outlet; texto mantém largura legível | toolbar horizontal e detalhe lateral quando útil         |
| ≥ 1600 px    | sidebar fixa e header baixo          | toda a largura útil; limites são aplicados aos filhos       | subgrades mantêm controles e leitura coerentes           |

## Wireframes aprováveis

### Hoje

```text
[Hoje + data]                         [sync contextual]
[próximo treino: nome, hora, progresso             ]
[Iniciar/continuar]
[resumo: semana | concluídos | pendências]
[registros rápidos: hábitos]
[dor e medidas — recolhidos, com estado e último registro]
```

No desktop, a sessão usa a largura do outlet e os três registros complementares formam colunas
equivalentes; o treino nunca herda a altura desses registros. No mobile, métricas fluem em uma
lista de três itens ou grid 1 × 3, sem 2 + 1.

### Planejamento

```text
[Planejamento] [Catálogo] [Planos] [Sessão avulsa]
[lista/mestre          ] [detalhe da decisão atual              ]
                         [uma etapa + ações anterior/próxima]
```

No mobile, a seleção abre uma página/etapa dedicada; formulários completos não ficam empilhados.

### Histórico

```text
[←] [Julho de 2026] [→]               [Filtros]
[calendário com geometria reservada ] [detalhe do dia]
[legenda de badges limitados        ] [ações de edição]
```

No mobile, o detalhe segue o calendário e recebe foco apenas após seleção explícita.

### Progresso

```text
[Progresso]                 [4s | 8s | 12s | personalizado]
[resultado principal] [resultado secundário] [consistência]
[narrativa: treino e volume                              ]
[narrativa: corpo                                        ]
[narrativa: dor — linguagem não diagnóstica              ]
```

Loading, vazio, gráfico e tabela equivalente mantêm a mesma altura contratada em cada narrativa.

### Conta

```text
[Conta]
Perfil        -------------------------------- [editar/salvar]
Dados         -------------------------------- [exportar]
Sessões       -------------------------------- [revogar]
Instalação    -------------------------------- [ver instruções]
Zona de risco -------------------------------- [excluir conta]
```

Separadores e whitespace definem seções; borda não é repetida em todos os níveis. A zona de risco
fica por último e não recebe a maior superfície da página.

## Estados transversais

- Loading reserva a geometria do resultado e mantém o título disponível.
- Vazio explica o próximo passo sem ilustração decorativa obrigatória.
- Erro informa o que não foi concluído e oferece recuperação local.
- Offline confirma que a escrita local permanece disponível quando aplicável.
- Pendente usa linguagem de produto: “Salvo neste dispositivo”.
- Conflito mostra campos compreensíveis e escolhas explícitas; nunca JSON ou enum cru por padrão.

## Gates antes do aceite

- Invariantes geométricas em todos os viewports e zoom suportados.
- Ritmo renderizado em todas as páginas autenticadas: 8 px dentro de cada campo e 16 px entre
  campos, títulos, divisores e o conteúdo que os sucede.
- Navegação a partir de scroll profundo, antes e depois de cargas assíncronas.
- Axe, teclado, reduced motion, forced colors e leitor de tela.
- Comparação lado a lado com este contrato e registro de decisão humana por tela/viewport.
- Snapshot novo somente depois do aceite; baseline legado permanece até então.
