import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Personnel, InventoryTicket } from '../types';

// Feature Flag to use local storage if Firebase is not configured properly
const USE_MOCK = false;

// --- Personnel API ---

export const getPersonnel = async (): Promise<Personnel[]> => {
  if (USE_MOCK) {
    const data = localStorage.getItem('mock_personnel');
    return data ? JSON.parse(data) : [];
  }
  const snapshot = await getDocs(collection(db, 'personnel'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel));
};

export const addPersonnel = async (person: Omit<Personnel, 'id'>): Promise<Personnel> => {
  if (USE_MOCK) {
    const newPerson = { ...person, id: Date.now().toString() };
    const existing = await getPersonnel();
    localStorage.setItem('mock_personnel', JSON.stringify([...existing, newPerson]));
    return newPerson;
  }
  const docRef = await addDoc(collection(db, 'personnel'), person);
  return { id: docRef.id, ...person };
};

export const updatePersonnel = async (id: string, person: Partial<Personnel>): Promise<void> => {
  if (USE_MOCK) {
    const existing = await getPersonnel();
    const updated = existing.map(p => p.id === id ? { ...p, ...person } : p);
    localStorage.setItem('mock_personnel', JSON.stringify(updated));
    return;
  }
  const docRef = doc(db, 'personnel', id);
  await updateDoc(docRef, person);
};

export const deletePersonnel = async (id: string): Promise<void> => {
  if (USE_MOCK) {
    const existing = await getPersonnel();
    const filtered = existing.filter(p => p.id !== id);
    localStorage.setItem('mock_personnel', JSON.stringify(filtered));
    return;
  }
  const docRef = doc(db, 'personnel', id);
  await deleteDoc(docRef);
};

// --- Tickets API ---

export const getTickets = async (): Promise<InventoryTicket[]> => {
  if (USE_MOCK) {
    const data = localStorage.getItem('mock_tickets');
    return data ? JSON.parse(data) : [];
  }
  const snapshot = await getDocs(collection(db, 'inventory_tickets'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTicket));
};

export const addTicket = async (ticket: Omit<InventoryTicket, 'id'>): Promise<InventoryTicket> => {
  if (USE_MOCK) {
    const newTicket = { ...ticket, id: Date.now().toString() };
    const existing = await getTickets();
    localStorage.setItem('mock_tickets', JSON.stringify([...existing, newTicket]));
    return newTicket;
  }
  const docRef = await addDoc(collection(db, 'inventory_tickets'), ticket);
  return { id: docRef.id, ...ticket };
};

export const updateTicket = async (id: string, ticket: Partial<InventoryTicket>): Promise<void> => {
  if (USE_MOCK) {
    const existing = await getTickets();
    const updated = existing.map(t => t.id === id ? { ...t, ...ticket } : t);
    localStorage.setItem('mock_tickets', JSON.stringify(updated));
    return;
  }
  const docRef = doc(db, 'inventory_tickets', id);
  await updateDoc(docRef, ticket);
};

export const deleteTicket = async (id: string): Promise<void> => {
  if (USE_MOCK) {
    const existing = await getTickets();
    const filtered = existing.filter(t => t.id !== id);
    localStorage.setItem('mock_tickets', JSON.stringify(filtered));
    return;
  }
  const docRef = doc(db, 'inventory_tickets', id);
  await deleteDoc(docRef);
};
