export interface Personnel {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  title: string;
  notes: string;
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
  assigneeId: string;
  dispatchDate: number | null; // Primary date used for stats/filtering
  closeDate: number | null; // Used to calculate processing days
  stageDates: Record<string, number>; // Maps workflow.id to timestamp
  managerName?: string;
  totalProcessingDays: number | null;
}
