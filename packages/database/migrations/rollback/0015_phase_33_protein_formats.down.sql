-- Reversão da migração 0015_phase_33_protein_formats.
--
-- Execute manualmente, em transação única, apenas quando for necessário voltar ao schema anterior.
-- A migração original só acrescentou colunas e restrições ao registro de proteína; nenhum registro
-- existente foi reescrito e nenhum dado de treino, medida ou recuperação depende delas.
--
-- Voltar ao schema anterior descarta informação já registrada: o formato do produto, a unidade da
-- dose e os ingredientes batidos junto deixam de existir. Registros de proteína pronta para beber e
-- de iogurte passariam a ser lidos como whey em pó, então eles são apagados aqui em vez de mudar de
-- significado em silêncio. Exporte antes de executar.

begin;

delete from whey_intakes where format <> 'powder';

alter table whey_intakes drop constraint whey_intakes_serving_unit_check;
alter table whey_intakes drop constraint whey_intakes_format_fields_check;
alter table whey_intakes drop constraint whey_intakes_not_consumed_check;

alter table whey_intakes drop column blended_with;
alter table whey_intakes drop column serving_unit;
alter table whey_intakes drop column format;

alter table whey_intakes add constraint whey_intakes_not_consumed_check check (
  consumed
  or num_nonnulls(
    powder_grams,
    servings,
    protein_per_serving_grams,
    mixed_with,
    liquid_ml,
    moment
  ) = 0
);

drop type protein_serving_unit;
drop type protein_format;

commit;
