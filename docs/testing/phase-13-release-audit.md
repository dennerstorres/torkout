# Auditoria da candidata 1.0.0

## Evidência automatizada acumulada

- Gate final: 33 arquivos/138 testes, lint, tipagem, formatação e builds aprovados.
- PostgreSQL final: 12 arquivos/50 testes aprovados, incluindo dois dispositivos, isolamento e rollback.
- E2E final: 15 jornadas aprovadas, incluindo resposta perdida, reconexão e PWA 1.0.0.
- Restauração isolada: 32 tabelas, RPO 0,0003 hora e RTO 6,89 segundos.
- Imagens: API e web não root; Trivy oficial 0.72.0 com zero HIGH/CRITICAL corrigível nas duas.

## Falhas encontradas antes da correção de release

1. `verify-phase-13.ps1` RED: nove artefatos de release ausentes, versões pré-1.0 e gate não ligado.
2. Rollback RED: a migração 0007 aposentava os documentos 2026-07-14 usados pela imagem web 0.11,
   impedindo novos aceites após rollback da aplicação.
3. Trivy 0.72 local interrompido: Docker Desktop alterou `meta.db` para somente-leitura ao encerrar
   o scan da API; o scan web não iniciou e o container/cache não puderam ser removidos.
4. Suíte em ambiente sem `dist`: o typecheck da API dependia de declarações geradas por uma execução
   anterior, pois o gate tentava validar tipos antes de construir os pacotes internos.
5. E2E de progressão: o seletor de versão ficou ambíguo depois que 1.0.0 passou a aparecer no selo e
   na explicação da regra; o comportamento estava correto, mas o teste estrito encontrou dois nós.
6. A primeira reexecução completa foi interrompida por `ENOSPC`; após o titular liberar espaço, o
   daemon Docker precisou de reinicialização limpa para remover os artefatos temporários autorizados.

## Correções

- Artefatos/gates 1.0 e checklist AC-01..AC-12 adicionados.
- Migração 0008 reativa temporariamente as versões legais anteriores; a integração executa a
  migração completa e comprova que o cliente anterior ainda consegue registrar aceite.
- Workflow usa release Trivy 0.72.0 assinada e arquivos de imagem somente-leitura, sem socket Docker.
- O gate agora constrói os pacotes internos antes do typecheck, ficando reproduzível sem `dist` antigo.
- O E2E seleciona exatamente o selo de versão; a suíte completa foi repetida após a correção.
- Docker foi recuperado sem limpeza global; somente volume/cache Trivy, tarballs e imagens Torkout
  criados por esta validação foram removidos.

## Evidência ainda obrigatória

- Checklist físico de dispositivos e acessibilidade manual.
- Coolify/HTTPS/DNS/SMTP, backup externo/lifecycle/restauração e workflow CI final no SHA candidato.
- Commit de encerramento, tag `v1.0.0` e autorização explícita de abertura somente depois dos itens acima.
