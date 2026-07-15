import { dataExportEntityNames, type DataExport } from '@torkout/contracts';

const CSV_NAMES: Record<(typeof dataExportEntityNames)[number], string> = {
  bodyMeasurements: 'body_measurements.csv',
  exercises: 'exercises.csv',
  exerciseSets: 'exercise_sets.csv',
  habitDefinitions: 'habit_definitions.csv',
  habitEntries: 'habit_entries.csv',
  habitOptions: 'habit_options.csv',
  painReports: 'pain_reports.csv',
  privacyAcceptances: 'privacy_acceptances.csv',
  progressionDecisions: 'progression_decisions.csv',
  progressionEvaluations: 'progression_evaluations.csv',
  progressionRuleVersions: 'progression_rule_versions.csv',
  progressionSuggestions: 'progression_suggestions.csv',
  scheduleRules: 'schedule_rules.csv',
  sessionExercises: 'session_exercises.csv',
  trainingPlans: 'training_plans.csv',
  userProfiles: 'user_profiles.csv',
  walkingDetails: 'walking_details.csv',
  workoutSessions: 'workout_sessions.csv',
  workoutTemplateExercises: 'workout_template_exercises.csv',
  workoutTemplates: 'workout_templates.csv',
  workoutTemplateSets: 'workout_template_sets.csv',
};

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function scalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function csvCell(value: unknown): string {
  let text = scalar(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: Array<Record<string, unknown>>): Buffer {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort((left, right) => {
    if (left === 'id') return -1;
    if (right === 'id') return 1;
    return left.localeCompare(right);
  });
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(','));
  return Buffer.concat([UTF8_BOM, Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8')]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
  };
}

function zip(files: Array<{ content: Buffer; name: string }>, now: Date): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const stamp = dosDateTime(now);
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const checksum = crc32(file.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file.content.length, 18);
    local.writeUInt32LE(file.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, file.content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(file.content.length, 20);
    central.writeUInt32LE(file.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + file.content.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function readme(data: DataExport): string {
  return [
    'Torkout - pacote de portabilidade de dados',
    `Versão do formato: ${data.formatVersion}`,
    `Gerado em: ${data.exportedAt} (instante UTC ISO 8601)`,
    `Fuso das datas civis: ${data.timeZone}`,
    '',
    'Unidades: weight=kilogram; waist/height=centimeter; distance=meter; duration=second.',
    'Relacionamentos usam colunas terminadas em Id. Datas civis usam YYYY-MM-DD.',
    'Objetos e listas aninhados são JSON dentro da célula CSV.',
    'pending_changes.csv contém somente alterações locais ainda não confirmadas pelo servidor.',
    'Sessões, tokens, hashes de senha, dispositivos, logs e metadados internos não são exportados.',
  ].join('\r\n');
}

export function buildCsvZip(data: DataExport, now = new Date()): Buffer {
  const files: Array<{ content: Buffer; name: string }> = [
    { content: Buffer.from(readme(data), 'utf8'), name: 'README.txt' },
    { content: csv([data.account]), name: 'account.csv' },
  ];
  for (const name of dataExportEntityNames) {
    files.push({ content: csv(data.entities[name]), name: CSV_NAMES[name] });
  }
  files.push({ content: csv(data.pendingChanges), name: 'pending_changes.csv' });
  return zip(files, now);
}

export function listZipEntries(archive: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString('utf8');
    entries.set(name, archive.subarray(contentStart, contentStart + compressedSize));
    offset = contentStart + compressedSize;
  }
  return entries;
}
