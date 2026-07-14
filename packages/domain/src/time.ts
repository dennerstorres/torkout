import { Temporal } from '@js-temporal/polyfill';

export function validateIanaTimeZone(timeZone: string): string {
  try {
    Temporal.Now.zonedDateTimeISO(timeZone);
    return timeZone;
  } catch {
    throw new Error(`Fuso horário IANA inválido: ${timeZone}`);
  }
}

export function instantToLocalDate(instant: string, timeZone: string): string {
  validateIanaTimeZone(timeZone);
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

export function localDateTimeToInstant(
  localDate: string,
  localTime: string,
  timeZone: string,
): string {
  validateIanaTimeZone(timeZone);
  try {
    return Temporal.PlainDateTime.from(`${localDate}T${localTime}`)
      .toZonedDateTime(timeZone, { disambiguation: 'reject' })
      .toInstant()
      .toString();
  } catch {
    throw new Error(
      `Data e hora local inexistente ou ambígua em ${timeZone}: ${localDate}T${localTime}`,
    );
  }
}
