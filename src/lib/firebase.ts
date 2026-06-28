import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";
import config from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(config);

// Initialize Firestore with the database ID specified in config
export const db = getFirestore(app, config.firestoreDatabaseId || "default");

export interface WorkspaceData {
  id: string; // The sync code (e.g. GOLAN-1234)
  catalog?: any[];
  project?: any;
  archivedProjects?: any[];
  drafts?: any[];
  customBranches?: string[];
  rates?: {
    rateElectrician: number;
    rateSenior: number;
    rateWithAssistant: number;
  };
  vatRate?: number;
  laborTemplates?: any[];
  lastUpdated: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Saves workspace data to Firestore.
 */
export async function saveWorkspaceToCloud(workspaceId: string, data: Omit<WorkspaceData, "id" | "lastUpdated">): Promise<void> {
  const cleanId = workspaceId.trim().toUpperCase();
  if (!cleanId) return;

  const docRef = doc(db, "workspaces", cleanId);
  const payload: WorkspaceData = {
    id: cleanId,
    ...data,
    lastUpdated: new Date().toISOString()
  };

  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${cleanId}`);
  }
}

/**
 * Loads workspace data from Firestore.
 */
export async function loadWorkspaceFromCloud(workspaceId: string): Promise<WorkspaceData | null> {
  const cleanId = workspaceId.trim().toUpperCase();
  if (!cleanId) return null;

  const docRef = doc(db, "workspaces", cleanId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as WorkspaceData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `workspaces/${cleanId}`);
  }
}

/**
 * Saves a historical backup copy for a workspace.
 */
export async function saveWorkspaceBackup(workspaceId: string, data: Omit<WorkspaceData, "id" | "lastUpdated">): Promise<string> {
  const cleanId = workspaceId.trim().toUpperCase();
  if (!cleanId) throw new Error("Sync code is empty");

  const backupId = new Date().getTime().toString();
  const backupDocRef = doc(db, "workspaces", cleanId, "backups", backupId);
  
  const payload = {
    id: backupId,
    ...data,
    lastUpdated: new Date().toISOString()
  };

  try {
    await setDoc(backupDocRef, payload);
    return backupId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${cleanId}/backups/${backupId}`);
    throw error;
  }
}

/**
 * Lists all backups for a workspace, ordered by date descending.
 */
export async function listWorkspaceBackups(workspaceId: string): Promise<any[]> {
  const cleanId = workspaceId.trim().toUpperCase();
  if (!cleanId) return [];

  const backupsColRef = collection(db, "workspaces", cleanId, "backups");
  const q = query(backupsColRef, orderBy("lastUpdated", "desc"));
  try {
    const querySnapshot = await getDocs(q);
    const backups: any[] = [];
    querySnapshot.forEach((docSnap) => {
      backups.push({
        backupId: docSnap.id,
        ...docSnap.data()
      });
    });
    return backups;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `workspaces/${cleanId}/backups`);
    return [];
  }
}

/**
 * Deletes a specific workspace backup.
 */
export async function deleteWorkspaceBackup(workspaceId: string, backupId: string): Promise<void> {
  const cleanId = workspaceId.trim().toUpperCase();
  if (!cleanId || !backupId) return;

  const backupDocRef = doc(db, "workspaces", cleanId, "backups", backupId);
  try {
    await deleteDoc(backupDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `workspaces/${cleanId}/backups/${backupId}`);
  }
}
