import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    // atau kalau mau lebih ketat:
    // autoTable: (options: import('jspdf-autotable').UserOptions) => jsPDF;
  }
}
