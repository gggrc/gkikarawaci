declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  export interface UserOptions {
    head?: string[][];
    body?: (string | number)[][];
    startY?: number;
    [key: string]: unknown; 
  }

  const autoTable: (doc: jsPDF, options: UserOptions) => void;
  export default autoTable;
}
