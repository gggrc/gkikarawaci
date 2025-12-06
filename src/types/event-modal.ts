export type PeriodicalDayOfWeek = number | "Per Tanggal" | null;

export interface EventModalData {
  type: 
    | 'add-single'
    | 'add-periodical'
    | 'edit-single'
    | 'edit-periodical-confirm'
    | 'flow-select';

  dateKey: string | null;
  oldName: string | null;
  newName: string;

  periodicalDayOfWeek: PeriodicalDayOfWeek; // ✅ SATU SUMBER KEBENARAN
  periodicalPeriod: string;
}
