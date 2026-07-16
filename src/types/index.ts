export interface Personnel {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  title: string;
  notes: string;
}

export type TicketStatus = 'Pending Dispatch' | 'In Progress' | 'Returned' | 'Confirmed' | 'Approved & Closed';

export interface InventoryTicket {
  id: string;
  title: string;
  assigneeId: string;
  status: TicketStatus;
  dispatchDate: number | null;
  returnDate: number | null;
  confirmDate: number | null;
  approvalDate: number | null;
  closeDate: number | null;
  managerName: string;
  totalProcessingDays: number | null;
}
