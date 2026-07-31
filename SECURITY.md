# Política de segurança

## Versões suportadas

O Torkout é um projeto pessoal e mantém apenas a linha atual em `main`. Correções de segurança são
aplicadas nela; não há backport para tags anteriores.

## Relatando uma vulnerabilidade

**Não abra uma issue pública** com detalhes exploráveis.

Use o [Private vulnerability reporting](https://github.com/dennerstorres/torkout/security/advisories/new)
do GitHub. Inclua, quando possível:

- descrição do problema e do impacto;
- passos para reproduzir;
- versão, commit ou URL onde foi observado;
- se você conseguiu acessar dados de outra conta.

Nunca inclua dados reais de outra pessoa, credenciais, tokens ou conteúdo de saúde no relato.
Descreva o caminho, não o dado.

Como projeto pessoal, não há SLA formal nem programa de recompensa. Procuro responder em até 7 dias
e corrigir problemas críticos assim que possível.

## Escopo

Fazem parte do escopo problemas neste código-fonte e na instância <https://torkout.dennerstorres.dev>,
em especial:

- acesso a dados de outro usuário (isolamento por conta é requisito central do projeto);
- falhas de autenticação, sessão ou recuperação de senha;
- vazamento de dados de saúde em logs, respostas de erro, exportação ou cache;
- injeção, XSS, CSRF e escalonamento de privilégio;
- exposição de segredo ou de configuração de infraestrutura.

Fora de escopo: ataques de negação de serviço, força bruta em volume, engenharia social, testes que
degradem o serviço e relatórios automatizados sem impacto demonstrado.

Ao testar a instância pública, use apenas contas suas e não tente acessar, alterar ou exfiltrar
dados de terceiros.

## Práticas do projeto

- Senhas com Argon2id; sessões em cookie `HttpOnly`, `Secure` e `SameSite=Lax`.
- Autorização aplicada no servidor, por usuário autenticado, em toda consulta e mutação.
- Logs estruturados sem corpos, cookies, cabeçalhos de autorização ou conteúdo de saúde.
- PostgreSQL em rede privada, com usuário de privilégio mínimo.
- Scan de segredos e de dependências na CI.

Detalhes em [`docs/security/threat-model.md`](docs/security/threat-model.md) e
[`docs/security/authorization-audit.md`](docs/security/authorization-audit.md).
