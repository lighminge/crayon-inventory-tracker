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

export interface InventoryTask {
  id: string;
  name: string;
  startDate: number;
  endDate: number;
  ticketType: '夾鉗' | 'TKW';
  totalItemCount: number;
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
  itemCount?: number; // 盤點項目數量
  taskId?: string; // 關聯的盤點任務 ID
}

export interface InventoryItemDetail {
  id: string; // Document ID (usually auto-generated)
  ticketId: string; // 盤點單號
  itemSeq: string; // 項目編號 (e.g. '001')
  subItemSeq?: string; // 明細子項 (e.g. '1')
  grossWeight: number; // 物料總重量
  containerType: string; // 容器類型
  containerCount: number; // 容器數量
  containerUnitWeight: number; // 容器單重
  materialUnitWeight: number; // 物料單重
  netWeight?: number; // 淨重 (Added)
  date?: string; // 日期 (Added)
  totalItemCount: number; // 物料總數
  createdAt?: number; // 建立時間
}
