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
  ticketType?: '夾鉗' | 'TKW' | '追加'; // Added ticket type
  isAdditional?: boolean;
  assigneeId: string;
  dispatchDate: number | null; // Primary date used for stats/filtering
  closeDate: number | null; // Used to calculate processing days
  stageDates: Record<string, number>; // Maps workflow.id to timestamp
  managerName?: string;
  totalProcessingDays: number | null;
  itemCount?: number; // 盤點項目數量
  hasRecount?: boolean;
  recountItems?: Record<string, string>;
  defaultRecountDate?: string;
  totalRecountCompletionDate?: string;
  recountAssigneeId?: string;
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

export interface HolidaySetting {
  id: string; // Document ID (usually YYYY-MM-DD format date string)
  date: string; // YYYY-MM-DD format
  type: 'holiday' | 'workday'; // holiday (skip calculation) or workday (make-up workday)
  description: string;
}

export type PermissionLevel = 'none' | 'view' | 'edit';

export interface ModulePermissions {
  dashboard: PermissionLevel;
  dispatch: PermissionLevel;
  tickets: PermissionLevel;
  workflowTickets: PermissionLevel;
  tasks: PermissionLevel;
  workflow: PermissionLevel;
  itemDetails: PermissionLevel;
  personnel: PermissionLevel;
  statistics: PermissionLevel;
  system: PermissionLevel; // usually only 'edit' for admin
  calendar: PermissionLevel;
}

export interface SystemUser {
  id: string; // document id (can be same as username or auto-generated)
  username: string;
  password?: string; // Optional because we might not send it to client if unnecessary, though for this mock we will
  name: string;
  personnelId?: string; // 對應的人員ID
  permissions: ModulePermissions;
}

export interface SystemLoginRecord {
  id: string;
  userId: string;
  username: string;
  loginTime: number;
  logoutTime?: number;
  ip?: string;
  location?: string;
}
