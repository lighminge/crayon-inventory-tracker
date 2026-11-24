import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Personnel, InventoryTicket, Workflow, InventoryTask, SystemUser, SystemLoginRecord, MaterialItem, MaterialHistoryLog } from '../types';

// Feature Flag to use local storage if Firebase is not configured properly
export const USE_MOCK = false;

// --- Tasks API ---
export const getTasks = async (): Promise<InventoryTask[]> => {
  const snapshot = await getDocs(collection(db, 'inventory_tasks'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTask)).sort((a, b) => b.startDate - a.startDate);
};

export const addTask = async (task: Omit<InventoryTask, 'id'>): Promise<InventoryTask> => {
  const newRef = doc(collection(db, 'inventory_tasks'));
  await setDoc(newRef, task);
  return { id: newRef.id, ...task };
};

export const updateTask = async (id: string, task: Partial<InventoryTask>): Promise<void> => {
  await updateDoc(doc(db, 'inventory_tasks', id), task);
};

export const deleteTask = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'inventory_tasks', id));
};


// --- Personnel API ---
export const getPersonnel = async (): Promise<Personnel[]> => {
  const snapshot = await getDocs(collection(db, 'personnel'));
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      id: doc.id, 
      roles: data.roles || ['盤點'], // Default to having '盤點' role for legacy data
      ...data 
    } as Personnel;
  });
};

export const addPersonnel = async (person: Omit<Personnel, 'id'>): Promise<Personnel> => {
  const newRef = doc(collection(db, 'personnel'));
  await setDoc(newRef, person);
  return { id: newRef.id, ...person };
};

export const updatePersonnel = async (id: string, person: Partial<Personnel>): Promise<void> => {
  await updateDoc(doc(db, 'personnel', id), person);
};

export const deletePersonnel = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'personnel', id));
};

// --- Workflow API ---
export const getWorkflows = async (): Promise<Workflow[]> => {
  const q = query(collection(db, 'workflows'), orderBy('order'));
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workflow));
  
  // Initialize default workflows if none exist
  if (results.length === 0) {
    const defaults: Omit<Workflow, 'id'>[] = [
      { name: '盤點單派送', order: 1 },
      { name: '盤點單繳回', order: 2 },
      { name: '盤點數確認', order: 3 },
      { name: '盤點數比對', order: 4 },
      { name: '主管核准', order: 5 }
    ];
    for (const w of defaults) {
      await addWorkflow(w);
    }
    return getWorkflows();
  }
  return results;
};

export const addWorkflow = async (workflow: Omit<Workflow, 'id'>): Promise<Workflow> => {
  const newRef = doc(collection(db, 'workflows'));
  await setDoc(newRef, workflow);
  return { id: newRef.id, ...workflow };
};

export const updateWorkflow = async (id: string, workflow: Partial<Workflow>): Promise<void> => {
  await updateDoc(doc(db, 'workflows', id), workflow);
};

export const deleteWorkflow = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'workflows', id));
};

// --- Tickets API ---
export const getTickets = async (): Promise<InventoryTicket[]> => {
  const snapshot = await getDocs(collection(db, 'inventory_tickets'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTicket));
};

export const addTicket = async (ticket: InventoryTicket): Promise<InventoryTicket> => {
  // Use the provided ID (e.g. 260701) as the document ID
  const docRef = doc(db, 'inventory_tickets', ticket.id);
  await setDoc(docRef, ticket);
  return ticket;
};

export const updateTicket = async (id: string, ticket: Partial<InventoryTicket>): Promise<void> => {
  await updateDoc(doc(db, 'inventory_tickets', id), ticket);
};

export const deleteTicket = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'inventory_tickets', id));
};

// --- Item Details API ---
import type { InventoryItemDetail } from '../types';
import { where } from 'firebase/firestore';

export const getItemDetails = async (ticketId: string): Promise<InventoryItemDetail[]> => {
  const q = query(collection(db, 'inventory_item_details'), where('ticketId', '==', ticketId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItemDetail)).sort((a, b) => a.itemSeq.localeCompare(b.itemSeq));
};

export const getAllItemDetails = async (): Promise<InventoryItemDetail[]> => {
  const snapshot = await getDocs(collection(db, 'inventory_item_details'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItemDetail));
};

export const checkItemDetailExists = async (ticketId: string, itemSeq: string, subItemSeq: string): Promise<InventoryItemDetail | null> => {
  const q = query(collection(db, 'inventory_item_details'), where('ticketId', '==', ticketId), where('itemSeq', '==', itemSeq), where('subItemSeq', '==', subItemSeq));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as InventoryItemDetail;
};

export const getExistingSubItems = async (ticketId: string, itemSeq: string): Promise<InventoryItemDetail[]> => {
  const q = query(collection(db, 'inventory_item_details'), where('ticketId', '==', ticketId), where('itemSeq', '==', itemSeq));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItemDetail));
};

export const saveItemDetail = async (detail: Omit<InventoryItemDetail, 'id'>, existingId?: string): Promise<InventoryItemDetail> => {
  if (existingId) {
    await updateDoc(doc(db, 'inventory_item_details', existingId), { ...detail });
    return { id: existingId, ...detail };
  } else {
    const newRef = doc(collection(db, 'inventory_item_details'));
    await setDoc(newRef, detail);
    return { id: newRef.id, ...detail };
  }
};

export const deleteItemDetail = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'inventory_item_details', id));
};

// --- Holidays API ---
import type { HolidaySetting } from '../types';

export const getHolidays = async (): Promise<HolidaySetting[]> => {
  const snapshot = await getDocs(collection(db, 'holidays'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HolidaySetting));
};

export const saveHoliday = async (holiday: HolidaySetting): Promise<void> => {
  await setDoc(doc(db, 'holidays', holiday.id), holiday);
};

export const deleteHoliday = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'holidays', id));
};

// --- System Users API ---
export const getSystemUsers = async (): Promise<SystemUser[]> => {
  const snapshot = await getDocs(collection(db, 'system_users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemUser));
};

export const addSystemUser = async (user: Omit<SystemUser, 'id'>): Promise<SystemUser> => {
  const newRef = doc(collection(db, 'system_users'));
  await setDoc(newRef, user);
  return { id: newRef.id, ...user };
};

export const updateSystemUser = async (id: string, user: Partial<SystemUser>): Promise<void> => {
  await updateDoc(doc(db, 'system_users', id), user);
};

export const deleteSystemUser = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'system_users', id));
};

// --- Login Records API ---
export const getLoginRecords = async (): Promise<SystemLoginRecord[]> => {
  const q = query(collection(db, 'system_login_records'), orderBy('loginTime', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLoginRecord));
};

export const addLoginRecord = async (record: Omit<SystemLoginRecord, 'id'>): Promise<SystemLoginRecord> => {
  const newRef = doc(collection(db, 'system_login_records'));
  const fullRecord = { id: newRef.id, ...record };
  await setDoc(newRef, fullRecord);
  return fullRecord;
};

export const updateLoginRecord = async (id: string, record: Partial<SystemLoginRecord>): Promise<void> => {
  await updateDoc(doc(db, 'system_login_records', id), record);
};

// --- Materials Inventory API ---
const LOCAL_MATERIALS_KEY = 'crayon_materials_v1';
const LOCAL_HEAD_TYPES_KEY = 'crayon_head_types_v1';

const getLocalMaterials = (): MaterialItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_MATERIALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  return [];
};

const setLocalMaterials = (items: MaterialItem[]) => {
  try {
    localStorage.setItem(LOCAL_MATERIALS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error(e);
  }
};

export const getMaterials = async (): Promise<MaterialItem[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'materials'));
    const remoteItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaterialItem));
    if (remoteItems.length > 0 || localStorage.getItem(LOCAL_MATERIALS_KEY) === null) {
      setLocalMaterials(remoteItems);
      return remoteItems;
    }
    return getLocalMaterials();
  } catch {
    return getLocalMaterials();
  }
};

export const addMaterial = async (mat: Omit<MaterialItem, 'id'>): Promise<MaterialItem> => {
  const newRef = doc(collection(db, 'materials'));
  const newItem: MaterialItem = { ...mat, id: newRef.id };
  const current = getLocalMaterials();
  setLocalMaterials([...current, newItem]);
  try {
    await setDoc(newRef, mat);
  } catch (e) {
    console.warn('Fallback to localStorage for addMaterial:', e);
  }
  return newItem;
};

export const updateMaterial = async (id: string, mat: Partial<MaterialItem>): Promise<void> => {
  const current = getLocalMaterials();
  setLocalMaterials(current.map(m => (m.id === id ? { ...m, ...mat, id } : m)));
  try {
    const payload = { ...mat };
    delete (payload as any).id;
    await updateDoc(doc(db, 'materials', id), payload);
  } catch (e) {
    console.warn('Fallback to localStorage for updateMaterial:', e);
  }
};

export const deleteMaterial = async (id: string): Promise<void> => {
  const current = getLocalMaterials();
  setLocalMaterials(current.filter(m => m.id !== id));
  try {
    await deleteDoc(doc(db, 'materials', id));
  } catch (e) {
    console.warn('Fallback to localStorage for deleteMaterial:', e);
  }
};

export const getHeadTypes = async (): Promise<string[]> => {
  const defaultTypes = ['A型', 'B型', 'C型'];
  try {
    const snap = await getDoc(doc(db, 'settings', 'headTypes'));
    if (snap.exists() && Array.isArray(snap.data().types)) {
      const types = snap.data().types as string[];
      localStorage.setItem(LOCAL_HEAD_TYPES_KEY, JSON.stringify(types));
      return types;
    }
    const localRaw = localStorage.getItem(LOCAL_HEAD_TYPES_KEY);
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed)) return parsed;
    }
    await setDoc(doc(db, 'settings', 'headTypes'), { types: defaultTypes });
    localStorage.setItem(LOCAL_HEAD_TYPES_KEY, JSON.stringify(defaultTypes));
    return defaultTypes;
  } catch {
    try {
      const localRaw = localStorage.getItem(LOCAL_HEAD_TYPES_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    localStorage.setItem(LOCAL_HEAD_TYPES_KEY, JSON.stringify(defaultTypes));
    return defaultTypes;
  }
};

export const saveHeadTypes = async (types: string[]): Promise<void> => {
  try {
    localStorage.setItem(LOCAL_HEAD_TYPES_KEY, JSON.stringify(types));
    await setDoc(doc(db, 'settings', 'headTypes'), { types });
  } catch (e) {
    console.warn('Fallback to localStorage for saveHeadTypes:', e);
  }
};

export const getMaterialHistoryLogs = async (): Promise<MaterialHistoryLog[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'controls'));
    const logs: MaterialHistoryLog[] = [];
    snapshot.docs.forEach(d => {
      const c = { id: d.id, ...d.data() } as any;
      (c.items || []).forEach((item: any) => {
        if (item.missingQuantity === 0 && item.restockDate) {
          logs.push({
            id: `${c.id}_${item.materialId}`,
            controlId: c.displayId || c.id?.slice(0, 8),
            materialId: item.materialId,
            materialName: item.materialName,
            restockDate: item.restockDate,
            requiredQuantity: item.requiredQuantity,
            notes: item.notes
          });
        }
      });
    });
    return logs;
  } catch {
    return [];
  }
};
