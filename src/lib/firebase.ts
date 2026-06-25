import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
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
  lastUpdated: string;
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

  await setDoc(docRef, payload, { merge: true });
}

/**
 * Loads workspace data from Firestore.
 */
export async function loadWorkspaceFromCloud(workspaceId: string): Promise<WorkspaceData | null> {
  const cleanId = workspaceId.trim().toUpperCase();
  if (!cleanId) return null;

  const docRef = doc(db, "workspaces", cleanId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as WorkspaceData;
  }
  return null;
}
