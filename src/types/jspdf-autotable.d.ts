import 'jspdf-autotable';

declare module "jspdf" {
  import type { UserOptions } from "jspdf-autotable";

  interface jsPDF {
    autoTable: (options: UserOptions) => jsPDF;
  }
}
