export interface Personnel {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  title: string;
  notes: string;
  roles?: string[]; // 工作職責
}

export interface Workflow {
  id: string;
  name: string;
  order: number;
  assigneeId?: string;
}

export interface InventoryTicket {
  id: string; // Firestore document ID (can be the custom manual ID like '260701')
  title: string; // We can use this as description/notes or just the ID again
  ticketType?: '夾鉗' | 'TKW'; // Added ticket type
  assigneeId: string;
  dispatchDate: number | null; // Primary date used for stats/filtering
  closeDate: number | null; // Used to calculate processing days
  stageDates: Record<string, number>; // Maps workflow.id to timestamp
  managerName?: string;
  totalProcessingDays: number | null;
}
