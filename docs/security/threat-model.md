# Threat model — Torkout 1.0

**Versão:** 1.0  
**Revisão:** 2026-07-15  
**Escopo:** PWA, API Fastify, Better Auth, PostgreSQL, SMTP, Coolify e backup S3

## Ativos e objetivos

- Credenciais, sessões e tokens devem permanecer confidenciais e revogáveis.
- Treinos, hábitos, medidas, dores e observações pertencem somente ao titular.
- Outbox e réplica local não podem cruzar contas no mesmo navegador.
- Histórico, exportação, exclusão, backup e restauração precisam preservar integridade.
- Disponibilidade deve cumprir RPO de 24 horas e RTO de 4 horas.

## Limites de confiança

```text
navegador/PWA ── HTTPS ──> proxy Coolify/nginx ── rede privada ──> API
      │                                                        │
      └── IndexedDB por usuário                    PostgreSQL <─┤
                                                           SMTP│
                                      job isolado ──> S3 backup
```

O navegador, a internet, e-mails recebidos e payloads são não confiáveis. Proxy, API, banco,
secret store e bucket são zonas distintas; comprometimento de uma não autoriza acesso amplo às
demais.

## Ameaças e controles

| ID    | Ameaça                               | Severidade | Controles                                                                        | Risco residual                                         |
| ----- | ------------------------------------ | ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| TM-01 | Apropriação de conta por senha/token | alta       | Argon2id, verificação, token curto/único, rate limit, cookies seguros, revogação | phishing permanece; comunicar ao titular               |
| TM-02 | CSRF/origem forjada                  | alta       | SameSite=Lax, Secure/HttpOnly, origem confiável e CSRF do Better Auth            | configuração errada de domínio; gate de headers        |
| TM-03 | IDOR entre titulares                 | crítica    | usuário derivado da sessão e filtro `user_id` em cada consulta                   | nova rota sem teste; matriz default-deny obrigatória   |
| TM-04 | XSS e roubo de dados locais          | alta       | CSP sem inline, React escaping, validação, dependências verificadas              | extensão maliciosa do navegador fora do controle       |
| TM-05 | Injeção SQL                          | alta       | Drizzle/queries parametrizadas, entrada Zod, usuário DB sem DDL                  | SQL manual exige revisão                               |
| TM-06 | Vazamento por logs/métricas          | alta       | sem body/headers sensíveis, redação Pino, rota normalizada, métricas agregadas   | mensagens de erro de biblioteca; logar somente tipo    |
| TM-07 | Cache de saúde autenticada           | alta       | API/auth Network Only; Cache Storage apenas app shell                            | bug futuro de estratégia; E2E de service worker        |
| TM-08 | Conflito/sync apaga registro         | alta       | idempotência, versões, tombstones e resolução explícita                          | falha de dispositivo antes de sync; exportar outbox    |
| TM-09 | Backup exposto ou irrecuperável      | crítica    | bucket privado, TLS, SSE, credencial restrita, checksum e restauração trimestral | chave do provedor; rotação e alerta de acesso          |
| TM-10 | Banco exposto publicamente           | crítica    | rede interna sem porta publicada, usuário mínimo, TLS/ACL do host                | erro operacional; checklist Coolify obrigatório        |
| TM-11 | Imagem/dependência comprometida      | alta       | lockfile, audit, scan Trivy, versões fixadas e revisão                           | zero-day; atualização semanal e mitigação registrada   |
| TM-12 | Abuso de cadastro/login              | média      | limites por rota/IP, respostas não enumeráveis e bloqueio administrativo         | ataque distribuído; CAPTCHA adaptativo futuro          |
| TM-13 | Operador acessa conteúdo de saúde    | alta       | UI administrativa sem saúde, privilégio mínimo e evento de auditoria             | acesso emergencial ao banco; procedimento de incidente |
| TM-14 | Exclusão incompleta                  | alta       | cascata ativa, sessão revogada, réplica apagada e retenção declarada             | cópias isoladas até expiração documentada              |

## Casos de abuso obrigatórios

1. Usuário A tenta UUID conhecido de B em cada grupo de recurso.
2. Cliente repete operação após timeout e tenta `baseVersion` obsoleta.
3. Origem externa envia mutação com cookie válido.
4. Atacante repete login/cadastro e tenta enumerar e-mail.
5. Payload inclui token, cookie, nota ou medida visando logs/exportação.
6. Banco indisponível recebe readiness e não deve receber tráfego novo.
7. Backup adulterado ou incompleto falha checksum/restauração.

## Aceite e revisão

Nenhum risco crítico/alto pode permanecer sem controle implementado ou mitigação explicitamente
aprovada pelo titular. Rever antes de cada release, após incidente, nova integração, mudança de
autenticação, armazenamento ou exposição de rede.
