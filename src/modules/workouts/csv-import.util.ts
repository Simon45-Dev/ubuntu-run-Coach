import { parse } from 'csv-parse/sync';
import { WorkoutType } from '@prisma/client';

const WORKOUT_TYPES = new Set(Object.values(WorkoutType));

export interface ParsedWorkoutRow {
  scheduledDate: Date;
  type: WorkoutType;
  distanceTargetKm?: number;
  durationTargetSec?: number;
  paceTarget?: string;
  hrZoneTarget?: string;
  rpeTarget?: number;
  instructions?: string;
}

export type ParseWorkoutsCsvResult = { rows: ParsedWorkoutRow[] } | { errors: string[] };

interface RawCsvRow {
  date?: string;
  type?: string;
  distanceKm?: string;
  durationSec?: string;
  paceTarget?: string;
  hrZoneTarget?: string;
  rpeTarget?: string;
  instructions?: string;
}

function parseOptionalNumber(
  raw: string | undefined,
  field: string,
  rowNum: number,
  errors: string[],
): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    errors.push(`Row ${rowNum}: "${field}" must be a number, got "${raw}"`);
    return undefined;
  }
  return value;
}

/**
 * Every row is validated (not just the first bad one) so a coach can fix
 * everything in one pass instead of a slow fix-one-reupload-repeat loop.
 * Row numbers count from 2 (row 1 is the header), matching what a coach
 * sees when they open the file in a spreadsheet editor.
 */
export function parseWorkoutsCsv(buffer: Buffer): ParseWorkoutsCsvResult {
  let records: RawCsvRow[];
  try {
    records = parse(buffer, { columns: true, trim: true, skip_empty_lines: true }) as RawCsvRow[];
  } catch (err) {
    return { errors: [`Could not parse CSV: ${err instanceof Error ? err.message : String(err)}`] };
  }

  if (records.length === 0) {
    return { errors: ['The CSV file has no data rows'] };
  }

  const errors: string[] = [];
  const rows: ParsedWorkoutRow[] = [];

  records.forEach((record, index) => {
    const rowNum = index + 2;

    if (!record.date) {
      errors.push(`Row ${rowNum}: "date" is required`);
    }
    const scheduledDate = record.date ? new Date(record.date) : null;
    if (record.date && (!scheduledDate || Number.isNaN(scheduledDate.getTime()))) {
      errors.push(`Row ${rowNum}: "date" is not a valid date: "${record.date}"`);
    }

    if (!record.type) {
      errors.push(`Row ${rowNum}: "type" is required`);
    } else if (!WORKOUT_TYPES.has(record.type as WorkoutType)) {
      errors.push(
        `Row ${rowNum}: "type" must be one of ${[...WORKOUT_TYPES].join(', ')}, got "${record.type}"`,
      );
    }

    const distanceTargetKm = parseOptionalNumber(record.distanceKm, 'distanceKm', rowNum, errors);
    const durationTargetSec = parseOptionalNumber(
      record.durationSec,
      'durationSec',
      rowNum,
      errors,
    );
    const rpeTarget = parseOptionalNumber(record.rpeTarget, 'rpeTarget', rowNum, errors);
    if (rpeTarget !== undefined && (rpeTarget < 1 || rpeTarget > 10)) {
      errors.push(`Row ${rowNum}: "rpeTarget" must be between 1 and 10, got ${rpeTarget}`);
    }

    if (
      scheduledDate &&
      !Number.isNaN(scheduledDate.getTime()) &&
      record.type &&
      WORKOUT_TYPES.has(record.type as WorkoutType)
    ) {
      rows.push({
        scheduledDate,
        type: record.type as WorkoutType,
        distanceTargetKm,
        durationTargetSec,
        paceTarget: record.paceTarget || undefined,
        hrZoneTarget: record.hrZoneTarget || undefined,
        rpeTarget,
        instructions: record.instructions || undefined,
      });
    }
  });

  if (errors.length > 0) {
    return { errors };
  }
  return { rows };
}
