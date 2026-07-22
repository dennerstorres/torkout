# Guia do usuário — Torkout

Este guia explica como configurar e usar o Torkout e como cadastrar manualmente um calendário
equivalente ao HTML que deu origem à aplicação.

O Torkout não importa aquele HTML nem cria um plano pessoal automaticamente. Uma conta nova começa
vazia. Você decide o que cadastrar, pode usar outras datas e pode alterar os valores deste exemplo.

> O plano reproduzido neste documento é apenas uma referência de cadastro. A aplicação não realiza
> diagnóstico e não substitui orientação médica ou profissional. Não atravesse dor articular para
> cumprir uma meta registrada.

## 1. Entenda os três tipos de informação

Antes de começar, vale separar três conceitos:

- **Planejamento:** o que deve aparecer no calendário no futuro, por exemplo, força toda terça,
  quinta e sábado.
- **Execução:** o que você realmente fez em cada série, caminhada ou hábito.
- **Registro retroativo:** uma sessão ou medição ocorrida no passado e cadastrada posteriormente.

Alterar um planejamento futuro não deve reescrever treinos que já foram registrados.

## 2. Primeiro acesso

Depois de criar a conta e confirmar o e-mail:

1. Informe seu nome de exibição.
2. Informe sua altura.
3. Peso e cintura iniciais são opcionais.
4. Confira o fuso horário. Para Cuiabá, use `America/Cuiaba`.
5. Informe o horário preferencial, por exemplo `18:00`.
6. Marque os hábitos que deseja acompanhar: Café, Arroz, Proteína e/ou Salada.
7. Leia e aceite os documentos apresentados.
8. Confirme que as sugestões não substituem avaliação ou orientação médica.
9. Toque em **Concluir configuração**.

Os hábitos iniciais marcados passam a aparecer na tela **Hoje**.

## 3. Navegação principal

- **Hoje:** sessões do dia, séries realizadas, caminhada, hábitos, dor e medições.
- **Planejamento:** catálogo de exercícios, planos semanais e sessões avulsas.
- **Histórico:** calendário e edição dos registros anteriores.
- **Progresso:** indicadores e gráficos produzidos a partir dos registros.
- **Conta:** perfil, instalação PWA, exportação e exclusão da conta.

No alto da aplicação há o estado de sincronização. Um número como `3 pendentes` significa que três
alterações estão seguras neste dispositivo e ainda aguardam envio ao servidor.

## 4. Criar exercícios

Flexão, agachamento livre e caminhada são criados automaticamente na sua conta. Eles são
exercícios normais: você pode editar nome e métrica, desativar, reativar ou excluir cada um.

Para adicionar outro exercício:

1. Abra **Planejamento**.
2. Escolha **Exercícios**.
3. Preencha **Nome do exercício**.
4. Escolha a métrica:
   - Repetições;
   - Duração;
   - Distância.
5. Toque em **Adicionar exercício**.

Para reproduzir a alternativa do HTML, cadastre:

| Campo             | Valor            |
| ----------------- | ---------------- |
| Nome do exercício | Ponte de glúteos |
| Métrica           | Repetições       |

Cadastrar um exercício não cria sessões no calendário. Ele apenas o disponibiliza nos editores.

Todos os exercícios aparecem com as ações **Editar**, **Ativar/Desativar** e **Excluir**, inclusive
os três criados inicialmente. Desativar ou excluir um exercício não apaga os treinos já
registrados; a alteração apenas impede seu uso em novos planejamentos.

## 5. Criar um plano semanal

1. Abra **Planejamento**.
2. Escolha **Plano semanal**.
3. Informe um nome para o plano e para o treino.
4. Escolha o tipo de atividade.
5. Configure o primeiro exercício, a quantidade de séries e o alvo por série.
6. Use **Adicionar exercício ao treino** quando o treino tiver mais de um exercício.
7. Informe o horário local.
8. Informe **Vigência a partir de** e **Vigência até**.
9. Marque os dias da semana.
10. Toque em **Salvar planejamento**.

As duas datas de vigência são inclusivas. Se a data final ficar vazia, a aplicação cria inicialmente
as ocorrências dos próximos 28 dias. Para reproduzir todo o HTML de uma vez, sempre informe a data
final indicada neste guia.

Planos já cadastrados aparecem acima do formulário. Use **Editar** para carregar o plano e o treino
no formulário; ao salvar, a nova recorrência substitui somente as sessões futuras a partir da nova
vigência. Use **Excluir** para remover o plano e suas sessões futuras ainda planejadas. Sessões já
iniciadas ou concluídas permanecem no histórico.

### Alvos em faixa

O HTML usa metas como `8–10` e `12–15`, mas o campo **Alvo por série** aceita um único número. Use o
limite inferior como meta e registre na tela **Hoje** o valor realmente realizado.

Exemplo: para `3 × 8–10`, cadastre três séries com alvo 8. Se fizer 10, informe 10 na execução.

## 6. Reproduzir o calendário do HTML de referência

O calendário original cobre 13/07/2026 a 12/10/2026:

- caminhada de 5 km às segundas e sextas, às 18h;
- força às terças, quintas e sábados, após as 18h;
- quarta-feira como recuperação;
- domingo como descanso;
- progressão dividida em quatro períodos.

Para evitar sessões duplicadas, crie cada item abaixo uma única vez e respeite exatamente as datas
de início e fim.

### 6.1 Caminhadas de segunda e sexta

Crie um plano semanal:

| Campo                | Valor                          |
| -------------------- | ------------------------------ |
| Nome do plano        | Recomposição 2026 — caminhadas |
| Nome do treino       | Caminhada 5 km                 |
| Tipo de atividade    | Caminhada                      |
| Exercício            | Caminhada                      |
| Séries               | 1                              |
| Alvo por série       | 5000                           |
| Horário local        | 18:00                          |
| Vigência a partir de | 13/07/2026                     |
| Vigência até         | 12/10/2026                     |
| Dias                 | Segunda-feira e Sexta-feira    |

A distância é informada em metros; `5000` equivale a 5 km.

### 6.2 Recuperação de quarta-feira

| Campo                | Valor                           |
| -------------------- | ------------------------------- |
| Nome do plano        | Recomposição 2026 — recuperação |
| Nome do treino       | Recuperação e movimento leve    |
| Tipo de atividade    | Descanso/recuperação            |
| Horário local        | 18:00                           |
| Vigência a partir de | 13/07/2026                      |
| Vigência até         | 12/10/2026                      |
| Dia                  | Quarta-feira                    |

Descanso/recuperação não precisa de exercício nem de série.

### 6.3 Descanso de domingo

| Campo                | Valor                        |
| -------------------- | ---------------------------- |
| Nome do plano        | Recomposição 2026 — domingos |
| Nome do treino       | Descanso semanal             |
| Tipo de atividade    | Descanso/recuperação         |
| Horário local        | 18:00                        |
| Vigência a partir de | 13/07/2026                   |
| Vigência até         | 12/10/2026                   |
| Dia                  | Domingo                      |

### 6.4 Força — semanas 1 e 2

Este bloco começa depois da primeira semana adaptada, evitando conflito com os registros especiais
descritos na seção 7.

| Campo                 | Valor                                 |
| --------------------- | ------------------------------------- |
| Nome do plano         | Recomposição 2026 — força semanas 1–2 |
| Nome do treino        | Força — adaptação                     |
| Tipo de atividade     | Força                                 |
| Exercício 1           | Flexão                                |
| Séries do exercício 1 | 3                                     |
| Alvo do exercício 1   | 8                                     |
| Exercício 2           | Agachamento livre                     |
| Séries do exercício 2 | 2                                     |
| Alvo do exercício 2   | 10                                    |
| Horário local         | 18:00                                 |
| Vigência a partir de  | 20/07/2026                            |
| Vigência até          | 02/08/2026                            |
| Dias                  | Terça-feira, Quinta-feira e Sábado    |

O HTML permite evoluir o agachamento de `2 × 10` até `3 × 12`. Use **Adicionar série em
Agachamento livre** durante a execução quando for apropriado; não é necessário aumentar o plano só
para cumprir o limite superior.

### 6.5 Força — semanas 3 e 4

| Campo             | Valor                                 |
| ----------------- | ------------------------------------- |
| Nome do plano     | Recomposição 2026 — força semanas 3–4 |
| Nome do treino    | Força — consolidação                  |
| Tipo de atividade | Força                                 |
| Flexão            | 3 séries, alvo 10                     |
| Agachamento livre | 3 séries, alvo 12                     |
| Horário local     | 18:00                                 |
| Vigência          | 03/08/2026 a 16/08/2026               |
| Dias              | Terça-feira, Quinta-feira e Sábado    |

Os limites superiores do HTML são 12 flexões e 15 agachamentos. Registre o realizado sem precisar
alterar o alvo inferior.

### 6.6 Força — semanas 5 a 8

| Campo             | Valor                                 |
| ----------------- | ------------------------------------- |
| Nome do plano     | Recomposição 2026 — força semanas 5–8 |
| Nome do treino    | Força — desenvolvimento               |
| Tipo de atividade | Força                                 |
| Flexão            | 3 séries, alvo 10                     |
| Agachamento livre | 3 séries, alvo 15                     |
| Horário local     | 18:00                                 |
| Vigência          | 17/08/2026 a 13/09/2026               |
| Dias              | Terça-feira, Quinta-feira e Sábado    |

No HTML, a orientação das flexões nesse período é parar antes da falha, sem número fixo. O alvo 10 é
apenas uma referência operacional. Registre o valor real de cada série.

### 6.7 Força — semanas 9 a 12

| Campo             | Valor                                  |
| ----------------- | -------------------------------------- |
| Nome do plano     | Recomposição 2026 — força semanas 9–12 |
| Nome do treino    | Força — progressão final               |
| Tipo de atividade | Força                                  |
| Flexão            | 4 séries, alvo 10                      |
| Agachamento livre | 3 séries, alvo 20                      |
| Horário local     | 18:00                                  |
| Vigência          | 14/09/2026 a 11/10/2026                |
| Dias              | Terça-feira, Quinta-feira e Sábado     |

O HTML também oferece `4 × 15` para agachamento. Se preferir essa alternativa, cadastre quatro
séries com alvo 15 em vez de três séries com alvo 20. Para uma variação mais difícil de flexão,
cadastre primeiro o novo exercício no catálogo e selecione-o neste bloco.

## 7. Cadastrar a primeira semana como retroativo

Esta seção é opcional. Use-a somente para registrar o que realmente aconteceu. Ela não é necessária
para criar os planos futuros.

Use **Planejamento → Sessão avulsa** somente para uma atividade que ainda não foi criada pelos
planos semanais. Informe tipo, nome, data, exercícios, séries e os valores realmente feitos e toque
em **Criar sessão avulsa**.

Uma sessão avulsa ainda com estado `planned` pode ser aberta em **Editar** para alterar nome, data,
tipo, exercícios, séries e alvos, ou removida com **Excluir**. Depois que a execução começa, ela vira
histórico e essas duas ações deixam de ficar disponíveis; correções da execução devem ser feitas no
fluxo de registro correspondente.

As caminhadas, quartas de recuperação e domingos de descanso já foram materializados pelos planos
das seções 6.1 a 6.3. Não crie outra sessão avulsa para essas datas, pois isso produziria duplicata.

### Exemplo do calendário original

| Data       | Como registrar                                                                          |
| ---------- | --------------------------------------------------------------------------------------- |
| 13/07/2026 | Sessão avulsa de força: Flexão 3 × 12 e Agachamento livre 3 × 15                        |
| 13/07/2026 | Use a caminhada já criada pelo plano e atualize seu estado no Histórico, se ela ocorreu |
| 14/07/2026 | Sessão avulsa de descanso/recuperação                                                   |
| 15/07/2026 | Use a recuperação já criada pelo plano ou deixe sem registro                            |
| 16/07/2026 | Sessão avulsa de força leve: Flexão 3 × 8 e somente o exercício de pernas realizado     |
| 17/07/2026 | Use a caminhada já criada pelo plano e atualize seu estado no Histórico                 |
| 18/07/2026 | Sessão avulsa de força leve conforme o que foi efetivamente realizado                   |
| 19/07/2026 | Use o descanso já criado e adicione a medição corporal, se realizada                    |

O teste de cinco agachamentos e a troca condicional por ponte de glúteos não devem virar duas metas
obrigatórias simultâneas. Registre somente o exercício que foi realizado:

- sem o agachamento: não o adicione à sessão retroativa;
- exercício interrompido: descreva o ocorrido nas observações do registro histórico;
- ponte realizada: adicione Ponte de glúteos à sessão, com três séries e valor 12;
- desconforto: registre nas observações; para o dia atual, use também **Dor e desconforto**.

Depois de criar uma sessão no passado, abra **Histórico**, selecione a data, altere seu estado para
**Concluído** ou **Parcial** e registre os detalhes relevantes nas observações. A tela histórica não
oferece o runner série a série; por isso, no cadastro retroativo, use como séries e alvos os valores
efetivamente realizados. O runner completo da seção 8 fica disponível para as sessões do dia atual.

## 8. Executar o treino do dia

Na tela **Hoje**:

1. Localize a sessão planejada.
2. Toque em **Iniciar** seguido do nome da sessão.
3. Preencha o valor realmente realizado em cada série.
4. Use **Adicionar série** se fez uma série além do planejado.
5. Use **Ignorar** quando um exercício não foi executado.
6. Use **Interromper** quando precisou parar o exercício.
7. Registre observações no exercício quando necessário.
8. Marque **Confirmo que não houve dor articular** somente quando isso for verdadeiro.
9. Toque em **Finalizar**.

Se a sessão não aconteceu, use **Marcar como perdido**. Use **Cancelar treino** quando a sessão não
dever mais contar como uma sessão esperada.

### O treino continua de onde você parou

Depois de iniciar, a sessão fica em andamento no próprio aparelho. Se você sair para outra área,
fechar o aplicativo ou recarregar a página, a tela **Hoje** reabre a execução exatamente no ponto em
que estava, com todos os valores já digitados. Enquanto a execução estiver aberta, o botão volta a
aparecer como **Continuar** caso você use **Voltar ao resumo**.

Depois de finalizar, marcar como perdido ou cancelar, a tela **Hoje** mostra apenas o desfecho do
dia e não oferece mais iniciar o mesmo treino. Correções são feitas pelo **Histórico**.

### Caminhada

Na execução de caminhada você pode informar:

- série de distância;
- distância realizada em metros;
- duração em segundos;
- observações.

Conversões úteis:

- 5 km = 5000 m;
- 45 minutos = 2700 segundos;
- 1 hora = 3600 segundos.

## 9. Hábitos do dia

Os hábitos selecionados no primeiro acesso e os hábitos personalizados ativos aparecem em
**Hoje → Hábitos do dia**. Escolha ou informe o valor correspondente e aguarde a indicação de
que foi salvo localmente.

### Criar e gerenciar hábitos

1. Abra **Planejamento** e escolha **Hábitos**.
2. Informe o nome e escolha o tipo: sim/não, quantidade, escala numérica ou escolha.
3. Para quantidade ou escala, informe uma unidade opcional. Para escolha, cadastre ao menos duas
   opções.
4. Toque em **Adicionar hábito**. O cadastro funciona offline e fica pendente de sincronização.

Na mesma área você pode editar, ativar, desativar ou excluir um hábito. Desativar remove o hábito
da tela Hoje sem apagar registros anteriores. Para preservar a identificação do histórico, um
hábito que já possui registros pode ser desativado, mas não excluído.

Para o checklist do HTML, os hábitos mais relevantes são:

- Café;
- Proteína;
- Arroz;
- Salada.

O Torkout registra acompanhamento simples; ele não faz contagem de calorias.

## 10. Registrar dor ou desconforto

1. Abra **Hoje**.
2. Expanda **Dor e desconforto**.
3. Escolha muscular ou articular.
4. Informe intensidade, momento e região.
5. Escreva uma observação se necessário.
6. Toque em **Registrar dor**.

Ausência de registro não significa ausência de dor. Por isso, a confirmação sem dor articular fica
dentro da execução do treino.

## 11. Registrar peso e medidas corporais

1. Abra **Hoje**.
2. Expanda **Peso e cintura**.
3. Informe **Data da medição**. A data pode estar no passado.
4. Preencha peso e/ou cintura, se disponíveis.
5. Use **Adicionar outra medida** para abdômen, bíceps, coxa, quadril/glúteos, pescoço, peito,
   panturrilha ou uma medida personalizada.
6. Escolha a unidade e informe o valor.
7. Toque em **Salvar medida**.

É válido salvar somente uma circunferência, sem peso nem cintura.

### Datas quinzenais do HTML

O HTML sugere medições em 19/07, 02/08, 16/08, 30/08, 13/09, 27/09 e 11/10/2026. A aplicação ainda
não cria lembretes recorrentes de medição. Registre cada medição manualmente com a data em que ela
foi feita.

Para comparar melhor os resultados, tente manter horário e condição de medição consistentes. Não
preencha uma data apenas para completar o calendário.

## 12. Histórico e correções

Abra **Histórico** para:

- navegar entre meses;
- filtrar por atividade, estado e dor;
- abrir um dia;
- corrigir observações, hábitos, peso, cintura, medidas adicionais e dor;
- identificar registros pendentes de sincronização.

Corrigir uma sessão histórica não altera o template que gerou as sessões futuras.

## 13. Progresso e sugestões

**Progresso** consolida os dados registrados. Um gráfico vazio normalmente significa que ainda não
há registros suficientes no período escolhido.

Sugestões de progressão não são aplicadas automaticamente. Revise a justificativa e aceite ou
rejeite conscientemente. Não aceite aumento apenas para fazer o calendário avançar.

## 14. Funcionamento offline e sincronização

Ao salvar uma alteração:

1. ela é gravada primeiro neste dispositivo;
2. entra na fila de pendências;
3. é enviada ao servidor quando houver conexão e autenticação válida.

Se aparecer **Offline**, **Pendente** ou **Erro**, não repita o cadastro imediatamente. Abra os
detalhes da sincronização e verifique se a alteração já está na lista. Use **Sincronizar agora** ou
**Tentar novamente** quando a conexão voltar.

Em um conflito, a aplicação mostra as versões local e do servidor para você escolher. Essa escolha
deve ser consciente; não existe sobrescrita silenciosa.

## 15. Instalar como aplicativo

As instruções completas ficam em **Conta**.

### iPhone/iPad

1. Abra o endereço pelo Safari.
2. Use o botão Compartilhar.
3. Escolha **Adicionar à Tela de Início**.

### Android/Chrome

1. Abra o menu do Chrome.
2. Escolha **Instalar app** ou **Adicionar à tela inicial**.

### Desktop

Use a opção de instalação exibida pelo navegador compatível. Instalar a PWA não cria outra conta;
ela usa a mesma conta e a réplica local daquele dispositivo.

## 16. Exportar seus dados

Em **Conta**, solicite a exportação disponível. O pacote contém os dados portáveis da conta e as
alterações locais pendentes, sem incluir senha, sessão ou token de autenticação.

Faça uma exportação antes de excluir a conta ou de trocar definitivamente de dispositivo.

## 17. Checklist depois de configurar o HTML

Confirme no **Histórico**:

- segundas e sextas mostram caminhada;
- terças, quintas e sábados mostram força no período correto;
- quartas mostram recuperação;
- domingos mostram descanso;
- não existem dois blocos de força sobrepostos na mesma data;
- o último bloco de força termina em 11/10/2026;
- a caminhada final de 12/10/2026 está presente;
- a primeira semana retroativa contém somente fatos realmente ocorridos;
- nenhuma sessão foi marcada como concluída apenas porque foi planejada.

Por fim, abra os detalhes da sincronização e confirme **0 alterações pendentes** e **Tudo
sincronizado**.
