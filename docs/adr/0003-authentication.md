# ADR-0003 — Autenticação e autorização

**Status:** Accepted

**Data:** 2026-07-14

**Responsáveis:** projeto Torkout

## Contexto

O Torkout terá cadastro público e armazenará dados pessoais sensíveis relativos a saúde. Senhas não podem ser armazenadas em texto puro, sessões precisam ser revogáveis e a API deve impedir acesso horizontal entre usuários. O produto também permite acesso local offline em aparelhos previamente autenticados.

Autenticação própria do zero amplia o risco em hashing, recuperação, cookies, CSRF, revogação e enumeração de contas.

## Decisão

- Usar Better Auth integrado ao Fastify e PostgreSQL.
- Usar e-mail e senha com verificação obrigatória.
- Configurar Argon2id para hash com parâmetros medidos no ambiente de produção.
- Persistir sessões revogáveis no banco.
- Transportar sessão em cookie `HttpOnly`, `Secure` e `SameSite=Lax`.
- Servir frontend e API sob a mesma origem quando possível.
- Aplicar proteção CSRF, validação de origem e rate limit.
- Revogar outras sessões após redefinição de senha.
- Registrar aceite versionado de privacidade e tratamento de dados de saúde.
- Obter `user_id` exclusivamente da sessão validada; payload não autoriza acesso.
- Permitir acesso local offline por no máximo 30 dias desde a última autenticação online bem-sucedida.
- Após o prazo offline, preservar dados e outbox, mas bloquear leitura/edição até revalidação.
- Particionar dados IndexedDB por usuário e impedir acesso cruzado ao trocar de conta.
- Manter papel administrativo mínimo, auditado e sem tela comum de conteúdo de saúde.

## Consequências positivas

- Fluxos críticos usam biblioteca especializada.
- Sessões podem ser listadas e revogadas.
- Cookies HttpOnly reduzem exposição do token a JavaScript.
- API mantém autorização centralizada.
- Validade offline equilibra disponibilidade e exposição em aparelho perdido.

## Consequências negativas e riscos

- O projeto depende da compatibilidade e das migrações do Better Auth.
- Cadastro público exige SMTP confiável e proteção contra abuso.
- Sem rede, revogação não chega imediatamente ao aparelho.
- Dados locais continuam protegidos principalmente pelo bloqueio do dispositivo; criptografia web com chave persistida não elimina risco de XSS.
- Configuração incorreta de proxy/cookies pode quebrar sessão ou reduzir segurança.

## Alternativas consideradas

### Autenticação implementada integralmente no projeto

Rejeitada pelo risco e pelo custo de manter hashing, tokens, cookies, reset e revogação.

### Supabase Auth

É tecnicamente válido, mas criaria uma dependência externa/híbrida sem necessidade após a escolha da stack auto-hospedada.

### JWT stateless em localStorage

Rejeitado pela exposição a JavaScript/XSS e pela dificuldade de revogação imediata.

### Sessão obrigatoriamente online em toda abertura

Rejeitada por impedir o requisito central de uso offline.

## Verificação

- Hash no banco nunca contém senha recuperável.
- Cookies possuem atributos exigidos em teste de integração.
- Testes negativos cobrem usuário A tentando acessar recursos de B.
- Reset invalida sessões conforme política.
- Dados locais funcionam dentro do prazo e bloqueiam após expiração sem apagar outbox.
- Logs não contêm senha, cookie, token ou conteúdo de saúde.

## Referências

- [Especificação de autenticação](../../SPEC.md#71-autenticação-e-conta)
- [Plano da Fase 3](../../PLAN.md#fase-3--autenticação-cadastro-público-e-privacidade)
- [ADR-0001](0001-technology-stack.md)
- [ADR-0002](0002-local-first-synchronization.md)
