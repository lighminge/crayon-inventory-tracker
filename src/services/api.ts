import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Personnel, InventoryTicket, Workflow } from '../types';

// Feature Flag to use local storage if Firebase is not configured properly
export const USE_MOCK = false;

// --- Personnel API ---
export const getPersonnel = async (): Promise<Personnel[]> => {
  const snapshot = await getDocs(collection(db, 'personnel'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel));
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
