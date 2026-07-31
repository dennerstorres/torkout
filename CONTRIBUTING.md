# Contribuindo com o Torkout

O Torkout é um projeto pessoal, publicado sob a [licença MIT](LICENSE). Contribuições são bem-vindas dentro do escopo definido no `SPEC.md`. Ao enviar um PR, você concorda em licenciar sua contribuição sob os mesmos termos.

Antes de investir tempo em uma mudança grande, abra uma issue descrevendo o problema ou a proposta. Itens listados como fora de escopo no `SPEC.md` só entram no produto mediante revisão da especificação; um PR que os implemente será recusado mesmo se estiver correto.

## Fontes de verdade

- [Especificação do produto](SPEC.md): comportamento esperado.
- [Plano de implementação](PLAN.md): fases, tarefas e critérios de saída.
- [Histórico](HISTORY.md): trabalho efetivamente realizado.
- [Regras de engenharia](CLAUDE.md): processo obrigatório, incluindo TDD.
- [Decisões arquiteturais](docs/adr/README.md): decisões aceitas e substituídas.

Em caso de conflito, requisitos explícitos do titular têm precedência. A documentação deve ser atualizada para refletir a decisão antes do encerramento da fase.

## Fluxo de trabalho

1. Verificar que o worktree está limpo e ler os documentos relevantes.
2. Identificar a fase e a tarefa ativa no `PLAN.md`.
3. Criar branch curta `phase/<numero>-<descricao>` quando o trabalho ocorrer em colaboração ou precisar de revisão isolada. Contribuições externas partem de um fork e de uma branch curta. No fluxo pessoal local do mantenedor, trabalho direto em `main` é permitido desde que cada fase continue atômica.
4. Aplicar TDD Red → Green → Refactor conforme `CLAUDE.md`.
5. Atualizar contratos, ADRs e histórico na mesma fase.
6. Executar todos os gates.
7. Revisar diff e possíveis segredos.
8. Criar o commit de encerramento previsto no plano apenas quando a fase estiver completa.

## Commits

Usar Conventional Commits:

- `feat`: comportamento novo.
- `fix`: correção.
- `test`: alteração exclusiva de teste.
- `docs`: documentação exclusiva.
- `refactor`: reorganização sem mudança comportamental.
- `chore`: infraestrutura, dependência ou manutenção.
- `release`: validação/entrega de versão.

Formato:

```text
tipo(escopo): descrição imperativa curta
```

Cada fase possui uma mensagem de encerramento prevista no `PLAN.md`. Commits parciais não encerram fase; commits `wip` devem ser consolidados quando seguro antes do encerramento.

## Branches e versões

- Branch principal: `main`.
- `main` deve permanecer verde e implantável após o início da automação.
- Branches de trabalho são curtas e partem de `main`.
- Releases seguem Semantic Versioning.
- Durante desenvolvimento inicial, versões podem permanecer em `0.x`.
- A primeira abertura pública que cumprir todos os critérios do `SPEC.md` será `1.0.0`.
- Mudança incompatível de API exige nova versão principal da API e da aplicação ou estratégia de compatibilidade documentada.

## Dependências

- Usar `pnpm` e versionar o lockfile.
- Preferir dependências já presentes e APIs da plataforma.
- Toda nova dependência precisa de justificativa técnica, manutenção ativa e licença compatível.
- Não adicionar duas bibliotecas para a mesma responsabilidade sem ADR.
- Usar versões suportadas e evitar versões prerelease em produção.
- Atualizações de patch/minor devem ser agrupadas e verificadas ao menos mensalmente.
- Atualizações major devem ser isoladas, testadas e registradas.
- Alertas críticos de segurança têm prioridade imediata.
- Nunca executar atualização automática diretamente em produção.

## Revisão

Uma revisão deve confirmar:

- correspondência com especificação e fase;
- evidência Red/Green/Refactor;
- isolamento entre usuários;
- validação de entrada e saída;
- comportamento offline e de conflito, quando aplicável;
- datas e fusos corretos;
- ausência de dados sensíveis em logs;
- acessibilidade e estados de erro;
- migrações e rollback/forward fix, quando aplicável.

## Relato de vulnerabilidades

Não abrir issue pública com detalhes exploráveis ou dados reais. O processo está em [`SECURITY.md`](SECURITY.md).
