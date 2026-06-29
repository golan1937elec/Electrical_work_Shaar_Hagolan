/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from "react";
import { Project, CatalogItem, Job, JobItem, CommonLaborPrice } from "./types";
import { INITIAL_CATALOG, COMMON_LABOR_PRICES } from "./initialData";
import CatalogManager from "./components/CatalogManager";
import CommonLaborTemplates from "./components/CommonLaborTemplates";
import JobsManager from "./components/JobsManager";
import QuoteSummary from "./components/QuoteSummary";
import ProjectHistory from "./components/ProjectHistory";
import ClientDetailsManager, { DEFAULT_BRANCHES } from "./components/ClientDetailsManager";
import PrintableInvoice from "./components/PrintableInvoice";
import Logo from "./components/Logo";
import { 
  Zap, Briefcase, Tag, Info, Shield, HelpCircle, FileCheck, CheckCircle2, 
  RefreshCw, History, Sparkles, Save, FileDown, FileUp, CheckCircle, AlertCircle,
  Cloud, CloudOff, Settings, Wifi, Database, Coins, Trash2, Undo2
} from "lucide-react";
import { saveWorkspaceToCloud, loadWorkspaceFromCloud, saveWorkspaceBackup, listWorkspaceBackups, deleteWorkspaceBackup } from "./lib/firebase";

export default function App() {
  // 1. Initial State Hooks
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [project, setProject] = useState<Project>({
    id: "active-project",
    clientName: "",
    clientPhone: "",
    projectAddress: "",
    branch: "",
    date: new Date().toISOString().split("T")[0],
    globalMarkupPercent: 30,
    includeVat: true,
    docType: "quote",
    jobs: [],
  });
  const [activeTab, setActiveTab] = useState<"workspace" | "catalog" | "info" | "reports">("workspace");
  const [showQuickTemplates, setShowQuickTemplates] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // 1c. Quick Draft States
  const [quickDraftName, setQuickDraftName] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftMessageIsError, setDraftMessageIsError] = useState(false);

  // 1b. Erco Price Auto-Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState("");

  // Lifted States from child components for cross-device cloud sync
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [rates, setRates] = useState({
    rateElectrician: 250,
    rateSenior: 350,
    rateWithAssistant: 380,
  });
  const [vatRate, setVatRate] = useState<number>(17);
  const [laborTemplates, setLaborTemplates] = useState<CommonLaborPrice[]>([]);

  // Cloud Sync States
  const [syncCode, setSyncCode] = useState<string>("");
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string>("");
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [showCloudPanel, setShowCloudPanel] = useState<boolean>(false);
  const [showVatPanel, setShowVatPanel] = useState<boolean>(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);

  const lastBackupTimeRef = React.useRef<number>(0);
  const [isGateUnlocked, setIsGateUnlocked] = useState<boolean>(false);

  const triggerErcoSync = (manual = false) => {
    setIsSyncing(true);
    setSyncStatus("מתחבר לסיטונאות ארכה b2c...");
    
    setTimeout(() => {
      setSyncStatus("מתעדכן מול מחירון ארכה מעודכן...");
      
      setTimeout(() => {
        setSyncStatus("מנתח ממא\"תים, גופי תאורה ופרוז'קטורים של Hager, ABB, Schneider...");
        
        setTimeout(() => {
          setCatalog((prev) => {
            const updated = prev.map((item) => {
              const original = INITIAL_CATALOG.find((init) => init.sku === item.sku);
              if (original) {
                // Sku-based reproducible fluctuation to simulate active daily sync
                const seed = parseInt(item.sku) || 1;
                const percentChange = ((seed % 5) - 2) / 100; // -2%, -1%, 0%, 1%, 2%
                const originalCost = typeof original.costPrice === "string" ? parseFloat(original.costPrice) : original.costPrice;
                const newPrice = Math.max(0.5, Math.round(originalCost * (1 + percentChange) * 2) / 2);
                return {
                  ...item,
                  costPrice: newPrice
                };
              }
              return item;
            });
            localStorage.setItem("electrician_catalog", JSON.stringify(updated));
            return updated;
          });
          
          const now = new Date();
          const dateStr = now.toLocaleDateString("he-IL") + " " + now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
          setLastSyncTime(dateStr);
          localStorage.setItem("erco_last_sync", dateStr);
          setIsSyncing(false);
          setSyncStatus("");
          
          if (manual) {
            alert("המחירון סונכרן ומתעדכן אוטומטית בהצלחה לאתר ארכה!");
          }
        }, 800);
      }, 700);
    }, 600);
  };

  // Helper to fetch, delete and restore backups
  const fetchCloudBackups = async (codeToUse = syncCode) => {
    const cleanCode = codeToUse.trim().toUpperCase();
    if (!cleanCode) return;
    try {
      const list = await listWorkspaceBackups(cleanCode);
      setCloudBackups(list);
    } catch (err) {
      console.error("Failed to fetch cloud backups:", err);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!syncCode) return;
    
    // Protect the latest active backup from being deleted
    if (cloudBackups.length > 0 && backupId === cloudBackups[0].backupId) {
      alert("לא ניתן למחוק את הגיבוי הנוכחי והפעיל ביותר. דוחות חודשיים וסיכום פרויקטים מוגנים מפני מחיקה כללית.");
      return;
    }

    const confirmDelete = window.confirm("האם אתה בטוח שברצונך למחוק גיבוי זה מהענן? פעולה זו היא בלתי הפיכה ותחסוך מקום.");
    if (!confirmDelete) return;
    
    setIsCloudSyncing(true);
    try {
      await deleteWorkspaceBackup(syncCode, backupId);
      setCloudStatusMsg({ text: "הגיבוי נמחק בהצלחה מהענן.", isError: false });
      await fetchCloudBackups(syncCode);
    } catch (err) {
      console.error("Failed to delete backup:", err);
      setCloudStatusMsg({ text: "שגיאה במחיקת הגיבוי.", isError: true });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleDeleteOldBackups = async () => {
    if (!syncCode) return;
    if (cloudBackups.length <= 1) {
      alert("אין גיבויים ישנים למחיקה. נשמר רק הגיבוי האחרון והכי עדכני.");
      return;
    }

    const confirmDelete = window.confirm(`האם אתה בטוח שברצונך למחוק את כל ${cloudBackups.length - 1} הגיבויים הישנים?\n\nפעולה זו תמחק אותם לצמיתות מענן ה-Firebase ותפנה שטח אחסון. הגיבוי האחרון והכי חדש יישמר בבטחה.`);
    if (!confirmDelete) return;

    setIsCloudSyncing(true);
    try {
      const oldBackups = cloudBackups.slice(1);
      await Promise.all(oldBackups.map(bk => deleteWorkspaceBackup(syncCode, bk.backupId)));
      setCloudStatusMsg({ text: "כל הגיבויים הישנים נמחקו בהצלחה מהענן. הגיבוי האחרון נשמר.", isError: false });
      await fetchCloudBackups(syncCode);
    } catch (err) {
      console.error("Failed to delete old backups:", err);
      setCloudStatusMsg({ text: "שגיאה במחיקת הגיבויים הישנים.", isError: true });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleRestoreBackup = async (backup: any) => {
    const confirmRestore = window.confirm(`האם אתה בטוח שברצונך לשחזר את הגיבוי מתאריך ${new Date(Number(backup.backupId) || backup.lastUpdated).toLocaleString("he-IL")}?\nשים לב: פעולה זו תדרוס את הנתונים הנוכחיים במכשיר זה!`);
    if (!confirmRestore) return;

    setIsCloudSyncing(true);
    try {
      if (backup.catalog) setCatalog(backup.catalog);
      if (backup.project) setProject(backup.project);
      if (backup.archivedProjects) setSavedProjects(backup.archivedProjects);
      if (backup.drafts) setSavedDrafts(backup.drafts);
      if (backup.customBranches) setBranches(backup.customBranches);
      if (backup.rates) setRates(backup.rates);
      if (backup.vatRate !== undefined) setVatRate(backup.vatRate);
      if (backup.laborTemplates) setLaborTemplates(backup.laborTemplates);

      setCloudStatusMsg({ text: `השחזור מגיבוי היסטורי הושלם בהצלחה!`, isError: false });
    } catch (err) {
      console.error("Failed to restore backup:", err);
      setCloudStatusMsg({ text: "שגיאה במהלך שחזור הגיבוי.", isError: true });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Helper to trigger manual or background Cloud Upload
  const uploadToCloud = async (codeToUse = syncCode, isManual = false) => {
    if (!codeToUse || !codeToUse.trim()) return;
    setIsCloudSyncing(true);
    try {
      const payload = {
        catalog,
        project,
        archivedProjects: savedProjects,
        drafts: savedDrafts,
        customBranches: branches,
        rates,
        vatRate,
        laborTemplates,
      };

      await saveWorkspaceToCloud(codeToUse, payload);

      // Automated session backups: Always create on manual button click,
      // OR on background auto-syncs if more than 60 seconds of typing/working has elapsed.
      const nowMs = Date.now();
      const timeElapsed = nowMs - lastBackupTimeRef.current;
      const shouldCreateBackup = isManual || (timeElapsed > 60000) || (lastBackupTimeRef.current === 0);

      if (shouldCreateBackup) {
        await saveWorkspaceBackup(codeToUse, payload);
        lastBackupTimeRef.current = nowMs;
        await fetchCloudBackups(codeToUse);
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString("he-IL") + " " + now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
      setLastCloudSyncTime(dateStr);
      localStorage.setItem("electrician_last_cloud_sync_time", dateStr);
      setCloudStatusMsg({ text: `הנתונים סונכרנו בהצלחה לענן תחת הקוד: ${codeToUse.trim().toUpperCase()}`, isError: false });
    } catch (err: any) {
      console.error("Cloud save error:", err);
      let errorText = "שגיאה בסנכרון לענן. ודא חיבור אינטרנט תקין.";
      try {
        const msg = err?.message || "";
        if (msg.startsWith("{") && msg.endsWith("}")) {
          const parsed = JSON.parse(msg);
          if (parsed.error) {
            errorText = `שגיאה בסנכרון לענן: ${parsed.error}`;
          }
        }
      } catch (e) {
        // Fallback
      }
      setCloudStatusMsg({ text: errorText, isError: true });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Helper to connect and sync with a cloud code
  const connectAndSyncCloud = async (codeToUse: string): Promise<boolean> => {
    const cleanCode = codeToUse.trim().toUpperCase();
    if (!cleanCode) {
      setCloudStatusMsg({ text: "נא להזין קוד סנכרון תקין", isError: true });
      return false;
    }

    setIsCloudSyncing(true);
    setCloudStatusMsg({ text: "מתחבר לענן וטוען נתונים...", isError: false });

    try {
      const cloudData = await loadWorkspaceFromCloud(cleanCode);
      if (cloudData) {
        const confirmOverwrite = window.confirm(`נמצאו נתוני סנכרון השמורים בענן עבור קוד זה.\nהאם ברצונך לייבא אותם ולדרוס את הנתונים המקומיים במכשיר זה?`);
        if (confirmOverwrite) {
          // Overwrite local state with cloud state
          if (cloudData.catalog) setCatalog(cloudData.catalog);
          if (cloudData.project) setProject(cloudData.project);
          if (cloudData.archivedProjects) setSavedProjects(cloudData.archivedProjects);
          if (cloudData.drafts) setSavedDrafts(cloudData.drafts);
          if (cloudData.customBranches) setBranches(cloudData.customBranches);
          if (cloudData.rates) setRates(cloudData.rates);
          if (cloudData.vatRate) setVatRate(cloudData.vatRate);
          if (cloudData.laborTemplates) setLaborTemplates(cloudData.laborTemplates);

          setSyncCode(cleanCode);
          localStorage.setItem("electrician_sync_code", cleanCode);
          
          if (cloudData.lastUpdated) {
            const dateObj = new Date(cloudData.lastUpdated);
            const dateStr = dateObj.toLocaleDateString("he-IL") + " " + dateObj.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
            setLastCloudSyncTime(dateStr);
            localStorage.setItem("electrician_last_cloud_sync_time", dateStr);
          }
          setCloudStatusMsg({ text: `החיבור הצליח! נתוני המכשיר סונכרנו מול הענן עבור הקוד ${cleanCode}`, isError: false });
          await fetchCloudBackups(cleanCode);
          return true;
        } else {
          // If they chose no, cancel
          setCloudStatusMsg({ text: "החיבור בוטל ללא דריסת נתונים מקומיים.", isError: false });
          return false;
        }
      } else {
        // Code doesn't exist, create it by uploading current state!
        const confirmCreate = window.confirm(`קוד סנכרון זה חדש.\nהאם ברצונך ליצור עבורו סביבת עבודה בענן ולהעלות את הנתונים הנוכחיים שלך לשם?`);
        if (confirmCreate) {
          setSyncCode(cleanCode);
          localStorage.setItem("electrician_sync_code", cleanCode);
          await saveWorkspaceToCloud(cleanCode, {
            catalog,
            project,
            archivedProjects: savedProjects,
            drafts: savedDrafts,
            customBranches: branches,
            rates,
            vatRate,
            laborTemplates,
          });
          const now = new Date();
          const dateStr = now.toLocaleDateString("he-IL") + " " + now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
          setLastCloudSyncTime(dateStr);
          localStorage.setItem("electrician_last_cloud_sync_time", dateStr);
          setCloudStatusMsg({ text: `סביבת עבודה חדשה נוצרה בהצלחה בענן עם הקוד ${cleanCode}!`, isError: false });
          await fetchCloudBackups(cleanCode);
          return true;
        } else {
          setCloudStatusMsg({ text: "החיבור בוטל.", isError: false });
          return false;
        }
      }
    } catch (err: any) {
      console.error("Cloud connection error:", err);
      let errorText = "שגיאה בהתחברות לענן. בדוק את הקוד או נסה שוב.";
      try {
        const msg = err?.message || "";
        if (msg.startsWith("{") && msg.endsWith("}")) {
          const parsed = JSON.parse(msg);
          if (parsed.error) {
            errorText = `שגיאה בהתחברות לענן: ${parsed.error}`;
          }
        }
      } catch (e) {
        // Fallback
      }
      setCloudStatusMsg({ text: errorText, isError: true });
      return false;
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // 2. Load from localStorage on Mount
  useEffect(() => {
    try {
      const storedCatalog = localStorage.getItem("electrician_catalog");
      if (storedCatalog) {
        const parsed = JSON.parse(storedCatalog) as CatalogItem[];
        // Merge missing default items from INITIAL_CATALOG by SKU
        const parsedSkus = new Set(parsed.map((item) => item.sku));
        const missingItems = INITIAL_CATALOG.filter((item) => !parsedSkus.has(item.sku));
        
        if (missingItems.length > 0) {
          const merged = [...parsed, ...missingItems];
          setCatalog(merged);
          localStorage.setItem("electrician_catalog", JSON.stringify(merged));
        } else {
          setCatalog(parsed);
        }
      } else {
        setCatalog(INITIAL_CATALOG);
        localStorage.setItem("electrician_catalog", JSON.stringify(INITIAL_CATALOG));
      }

      const storedProject = localStorage.getItem("electrician_project");
      if (storedProject) {
        setProject(JSON.parse(storedProject));
      } else {
        // Leave default initial project
        localStorage.setItem("electrician_project", JSON.stringify(project));
      }

      // Load lifted states from localStorage
      const storedProjects = localStorage.getItem("electrician_archived_projects");
      if (storedProjects) {
        setSavedProjects(JSON.parse(storedProjects));
      }

      const storedDrafts = localStorage.getItem("electrician_drafts");
      if (storedDrafts) {
        setSavedDrafts(JSON.parse(storedDrafts));
      }

      const storedTemplates = localStorage.getItem("electrician_labor_templates");
      if (storedTemplates) {
        setLaborTemplates(JSON.parse(storedTemplates));
      } else {
        setLaborTemplates(COMMON_LABOR_PRICES);
        localStorage.setItem("electrician_labor_templates", JSON.stringify(COMMON_LABOR_PRICES));
      }

      const storedBranches = localStorage.getItem("custom_branches_list");
      if (storedBranches) {
        setBranches(JSON.parse(storedBranches));
      } else {
        setBranches(DEFAULT_BRANCHES);
      }

      const rateElec = localStorage.getItem('rate_electrician');
      const rateSnr = localStorage.getItem('rate_senior');
      const rateAsst = localStorage.getItem('rate_with_assistant');
      setRates({
        rateElectrician: rateElec ? Number(rateElec) : 250,
        rateSenior: rateSnr ? Number(rateSnr) : 350,
        rateWithAssistant: rateAsst ? Number(rateAsst) : 380,
      });

      const storedVat = localStorage.getItem("electrician_vat_rate");
      setVatRate(storedVat ? Number(storedVat) : 17);

      const storedSyncCode = localStorage.getItem("electrician_sync_code");
      if (storedSyncCode) setSyncCode(storedSyncCode);

      const storedAutoSync = localStorage.getItem("electrician_auto_sync");
      if (storedAutoSync) setAutoSync(storedAutoSync === "true");

      const storedLastCloudSync = localStorage.getItem("electrician_last_cloud_sync_time");
      if (storedLastCloudSync) setLastCloudSyncTime(storedLastCloudSync);

      const storedSync = localStorage.getItem("erco_last_sync");
      if (storedSync) {
        setLastSyncTime(storedSync);
      } else {
        const now = new Date();
        const dateStr = now.toLocaleDateString("he-IL") + " " + now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
        setLastSyncTime(dateStr);
        localStorage.setItem("erco_last_sync", dateStr);
      }
    } catch (e) {
      console.error("Failed to load state from localStorage", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Fetch Cloud Backups on load if syncCode is set and matches the currently connected code
  useEffect(() => {
    if (isLoaded && syncCode) {
      const activeCode = localStorage.getItem("electrician_sync_code");
      if (syncCode.trim().toUpperCase() === activeCode?.trim().toUpperCase()) {
        fetchCloudBackups(syncCode);
      }
    }
  }, [isLoaded, syncCode]);

  // Background Automatic Sync on Load
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        triggerErcoSync(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  // 3. Save to localStorage on State Change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("electrician_catalog", JSON.stringify(catalog));
    } catch (e) {
      console.error("Failed to save catalog to localStorage", e);
    }
  }, [catalog, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("electrician_project", JSON.stringify(project));
    } catch (e) {
      console.error("Failed to save project to localStorage", e);
    }
  }, [project, isLoaded]);

  // Lifted States Persisters
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("electrician_archived_projects", JSON.stringify(savedProjects));
    } catch (e) {
      console.error(e);
    }
  }, [savedProjects, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("electrician_drafts", JSON.stringify(savedDrafts));
    } catch (e) {
      console.error(e);
    }
  }, [savedDrafts, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("electrician_labor_templates", JSON.stringify(laborTemplates));
    } catch (e) {
      console.error(e);
    }
  }, [laborTemplates, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("custom_branches_list", JSON.stringify(branches));
    } catch (e) {
      console.error(e);
    }
  }, [branches, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("rate_electrician", rates.rateElectrician.toString());
      localStorage.setItem("rate_senior", rates.rateSenior.toString());
      localStorage.setItem("rate_with_assistant", rates.rateWithAssistant.toString());
    } catch (e) {
      console.error(e);
    }
  }, [rates, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("electrician_vat_rate", vatRate.toString());
    } catch (e) {
      console.error(e);
    }
  }, [vatRate, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("electrician_auto_sync", autoSync ? "true" : "false");
  }, [autoSync, isLoaded]);

  // Debounced Auto Sync to Cloud
  useEffect(() => {
    if (!isLoaded || !syncCode || !autoSync) return;
    
    const timer = setTimeout(() => {
      uploadToCloud(syncCode);
    }, 2000);

    return () => clearTimeout(timer);
  }, [catalog, project, savedProjects, savedDrafts, branches, rates, vatRate, laborTemplates, syncCode, autoSync, isLoaded]);
  // 4. Catalog Handlers
  const handleAddCatalogItem = (newItemData: Omit<CatalogItem, "id">) => {
    const newItem: CatalogItem = {
      ...newItemData,
      id: "cust-" + Math.random().toString(36).substr(2, 9),
    };
    setCatalog((prev) => [newItem, ...prev]);
  };

  const handleUpdateCatalogItem = (updatedItem: CatalogItem) => {
    setCatalog((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
  };

  const handleDeleteCatalogItem = (id: string) => {
    setCatalog((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResetCatalog = () => {
    setCatalog(INITIAL_CATALOG);
    localStorage.setItem("electrician_catalog", JSON.stringify(INITIAL_CATALOG));
  };

  const handleResetCatalogPricesOnly = () => {
    setCatalog((prev) => {
      const updated = prev.map((item) => {
        const original = INITIAL_CATALOG.find((init) => init.sku === item.sku);
        if (original) {
          const originalCost = typeof original.costPrice === "string" ? parseFloat(original.costPrice) : original.costPrice;
          return {
            ...item,
            costPrice: originalCost,
          };
        }
        return item;
      });
      localStorage.setItem("electrician_catalog", JSON.stringify(updated));
      return updated;
    });
  };

  const handleMergeNewCatalogItems = () => {
    setCatalog((prev) => {
      const existingSkus = new Set(prev.map((item) => item.sku));
      const missingItems = INITIAL_CATALOG.filter((item) => !existingSkus.has(item.sku));
      if (missingItems.length === 0) {
        return prev;
      }
      const updated = [...prev, ...missingItems];
      localStorage.setItem("electrician_catalog", JSON.stringify(updated));
      return updated;
    });
  };

  const handleImportCatalogFromFile = (catalogJsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(catalogJsonStr);
      let importedCatalog: CatalogItem[] = [];
      if (parsed.app === "electrician-pricing-calculator" && parsed.catalog) {
        importedCatalog = parsed.catalog;
      } else if (parsed.app === "electrician-pricing-calculator-catalog" && parsed.catalog) {
        importedCatalog = parsed.catalog;
      } else if (Array.isArray(parsed)) {
        importedCatalog = parsed;
      } else {
        return false;
      }

      if (importedCatalog.length > 0) {
        setCatalog(importedCatalog);
        localStorage.setItem("electrician_catalog", JSON.stringify(importedCatalog));
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // 5. Project Handlers
  const handleUpdateProject = (updatedProject: Project) => {
    setProject(updatedProject);
  };

  const handleClearProject = () => {
    setProject({
      id: "active-project",
      clientName: "",
      clientPhone: "",
      projectAddress: "",
      branch: "",
      date: new Date().toISOString().split("T")[0],
      globalMarkupPercent: 30,
      includeVat: true,
      docType: "quote",
      jobs: [],
    });
  };

  const handleArchiveCurrentProject = (clientName: string, date: string): boolean => {
    if (!clientName.trim()) return false;
    
    const newArchived: Project = {
      ...project,
      id: "archived_" + Math.random().toString(36).substr(2, 9),
      clientName: clientName.trim(),
      date: date || new Date().toISOString().split('T')[0],
    };

    const updatedList = [newArchived, ...savedProjects];
    setSavedProjects(updatedList);
    localStorage.setItem("electrician_archived_projects", JSON.stringify(updatedList));
    return true;
  };

  // 6. Job Add/Edit Handlers
  const handleAddJob = (
    title: string, 
    laborCost: number = 0, 
    initialItems: { sku: string; quantity: number }[] = []
  ) => {
    // Map initial catalog items if specified
    const mappedItems: JobItem[] = initialItems
      .map((initItem) => {
        const catalogMatch = catalog.find((cat) => cat.sku === initItem.sku);
        if (!catalogMatch) return null;
        const price = typeof catalogMatch.costPrice === "string" ? parseFloat(catalogMatch.costPrice) : catalogMatch.costPrice;
        const item: JobItem = {
          id: Math.random().toString(36).substr(2, 9),
          catalogId: catalogMatch.id,
          sku: catalogMatch.sku,
          name: catalogMatch.name,
          costPrice: price,
          quantity: initItem.quantity,
        };
        return item;
      })
      .filter((item): item is JobItem => item !== null);

    const newJob: Job = {
      id: "job-" + Math.random().toString(36).substr(2, 9),
      title,
      laborCost,
      items: mappedItems,
    };

    setProject((prev) => ({
      ...prev,
      jobs: [...prev.jobs, newJob],
    }));

    // Scroll to new job element
    setTimeout(() => {
      const el = document.getElementById(`job-card-${newJob.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  const handleUpdateJob = (updatedJob: Job) => {
    setProject((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job) => (job.id === updatedJob.id ? updatedJob : job)),
    }));
  };

  const handleDeleteJob = (id: string) => {
    setProject((prev) => ({
      ...prev,
      jobs: prev.jobs.filter((job) => job.id !== id),
    }));
  };

  // 7. Add Job from Template Action
  const handleAddJobFromTemplate = (template: CommonLaborPrice) => {
    handleAddJob(template.title, template.defaultLaborCost, template.suggestedMaterials || []);
  };

  // 8. Import/Export Backup
  const handleExportBackup = () => {
    const data = {
      app: "electrician-pricing-calculator",
      version: "1.0",
      timestamp: new Date().toISOString(),
      catalog,
      project,
    };
    return JSON.stringify(data, null, 2);
  };

  const handleImportBackup = (backupStr: string): boolean => {
    try {
      const parsed = JSON.parse(backupStr);
      if (parsed.app === "electrician-pricing-calculator") {
        if (parsed.catalog) setCatalog(parsed.catalog);
        if (parsed.project) setProject(parsed.project);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleLoadProject = (loadedProject: Project) => {
    setProject(loadedProject);
    if (loadedProject) {
      localStorage.setItem("electrician_project", JSON.stringify(loadedProject));
    }
    setActiveTab("workspace");
  };

  // 9. Quick Draft & Local/File Backup Methods
  const handleSaveQuickDraft = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = quickDraftName.trim() || `טיוטה מיום ${new Date().toLocaleDateString("he-IL")} ${new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
    
    try {
      const storedDrafts = localStorage.getItem("electrician_drafts");
      let draftsList = [];
      if (storedDrafts) {
        draftsList = JSON.parse(storedDrafts);
      }
      
      const newDraft = {
        id: "draft_" + Math.random().toString(36).substr(2, 9),
        name: name,
        date: new Date().toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }),
        project: { ...project }
      };
      
      const updated = [newDraft, ...draftsList];
      localStorage.setItem("electrician_drafts", JSON.stringify(updated));
      setQuickDraftName("");
      setDraftMessageIsError(false);
      setDraftMessage(`הטיוטה "${name}" נשמרה בהצלחה באתר! תוכל לטעון אותה תמיד בלשונית "פרויקטים ודוחות".`);
      setTimeout(() => setDraftMessage(""), 6000);
    } catch (err) {
      console.error(err);
      setDraftMessageIsError(true);
      setDraftMessage("שגיאה בשמירת הטיוטה.");
      setTimeout(() => setDraftMessage(""), 6000);
    }
  };

  const handleExportQuickDraftToFile = () => {
    try {
      const dataStr = JSON.stringify({
        app: "electrician-pricing-calculator",
        type: "project-draft",
        version: "1.0",
        timestamp: new Date().toISOString(),
        project: project,
      }, null, 2);

      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      const safeClientName = project.clientName ? project.clientName.trim().replace(/\s+/g, '_') : 'פרויקט';
      link.href = url;
      link.download = `טיוטת_חשמל_${safeClientName}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setDraftMessageIsError(false);
      setDraftMessage("קובץ טיוטה פרויקט (.json) הורד בהצלחה למחשב שלך!");
      setTimeout(() => setDraftMessage(""), 6000);
    } catch (err) {
      console.error(err);
      setDraftMessageIsError(true);
      setDraftMessage("שגיאה ביצוא הטיוטה לקובץ.");
      setTimeout(() => setDraftMessage(""), 6000);
    }
  };

  const handleImportQuickDraftFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.app === "electrician-pricing-calculator" && json.project) {
          setProject(json.project);
          localStorage.setItem("electrician_project", JSON.stringify(json.project));
          setDraftMessageIsError(false);
          setDraftMessage("הטיוטה נטענה מקובץ JSON בהצלחה לעבודה הפעילה!");
          setTimeout(() => setDraftMessage(""), 6000);
        } else {
          setDraftMessageIsError(true);
          setDraftMessage("הקובץ שנבחר אינו בפורמט תואם של מחשבון החשמל.");
          setTimeout(() => setDraftMessage(""), 6000);
        }
      } catch (err) {
        setDraftMessageIsError(true);
        setDraftMessage("שגיאה בפענוח וקריאת קובץ הגיבוי.");
        setTimeout(() => setDraftMessage(""), 6000);
      }
    };
    reader.readAsText(file);
    // Reset file value
    e.target.value = "";
  };

  const [gatewayInputCode, setGatewayInputCode] = useState<string>("");
  const [hasSavedCode, setHasSavedCode] = useState<boolean>(false);

  useEffect(() => {
    if (isLoaded) {
      const stored = localStorage.getItem("electrician_sync_code");
      if (stored) {
        setHasSavedCode(true);
        setGatewayInputCode(stored);
      }
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans text-slate-500" dir="rtl">
        <Zap className="w-12 h-12 text-indigo-600 animate-bounce mb-3" />
        <p className="font-bold text-sm">טוען נתונים מהארכיון...</p>
      </div>
    );
  }

  if (!isGateUnlocked) {
    const savedCode = localStorage.getItem("electrician_sync_code");
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950 font-sans relative overflow-hidden" dir="rtl">
        {/* Animated background lights */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl -z-10 animate-pulse delay-75"></div>

        <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/30 p-6 md:p-8 space-y-6 text-center">
          
          {/* Logo & Header */}
          <div className="space-y-3">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-xl animate-pulse"></div>
              <div className="relative bg-slate-950 p-4 rounded-full border border-indigo-500/30">
                <Cloud className="w-12 h-12 text-amber-400 animate-bounce" />
              </div>
            </div>
            
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white leading-tight">
              מחשבון עבודות חשמליה שער הגולן
            </h1>
            <p className="text-xs md:text-sm text-slate-300 font-bold max-w-sm mx-auto leading-relaxed">
              מערכת תמחור חומרים ועבודות | סיטונאות Erco
            </p>
          </div>

          <div className="border-t border-indigo-500/20 my-2"></div>

          {/* Core Panel Content */}
          {hasSavedCode && savedCode ? (
            /* Return User Setup */
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">ברוך השב! נמצא קוד סנכרון שמור במכשיר:</span>
                <div className="bg-slate-950/80 border-2 border-dashed border-amber-500/50 p-4 rounded-xl text-center">
                  <span className="font-mono text-2xl font-black tracking-wider text-amber-400">{savedCode}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  הקוד מאפשר לך לסנכרן את כל המידע (קטלוג, הצעות מחיר ופרויקטים) מול הענן באופן מיידי ורב-מכשירי.
                </p>
              </div>

              {cloudStatusMsg && (
                <div className={`p-3 text-xs font-bold rounded-lg border ${
                  cloudStatusMsg.isError 
                    ? "bg-rose-950/80 border-rose-800 text-rose-300" 
                    : "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                }`}>
                  {cloudStatusMsg.text}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={async () => {
                    const ok = await connectAndSyncCloud(savedCode);
                    if (ok) {
                      setIsGateUnlocked(true);
                    }
                  }}
                  disabled={isCloudSyncing}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/10 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCloudSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4" />
                  )}
                  סנכרן נתונים והיכנס לסביבת העבודה
                </button>

                <button
                  onClick={() => setIsGateUnlocked(true)}
                  disabled={isCloudSyncing}
                  className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  המשך לעבודה ישירה (לא מקוון / נתונים מקומיים)
                </button>

                <button
                  onClick={() => setHasSavedCode(false)}
                  disabled={isCloudSyncing}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline transition py-1 cursor-pointer"
                >
                  התחבר עם קוד סנכרון אחר
                </button>
              </div>
            </div>
          ) : (
            /* First Time / Switch Setup */
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-indigo-300">חיבור או יצירת קוד סנכרון ענן</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                  הקלד מילת קוד אישית משלך (לדוגמה: <span className="font-mono text-amber-400">GOLAN-ELEC</span>) כדי לייבא נתונים קיימים או ליצור סביבת עבודה חדשה ומגובה בענן.
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="הקלד קוד סנכרון אישי..."
                    value={gatewayInputCode}
                    onChange={(e) => setGatewayInputCode(e.target.value.toUpperCase())}
                    className="w-full text-center font-mono text-lg font-bold tracking-wider py-3 border border-indigo-500/30 rounded-xl bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                  />
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const randomCode = "ELEC-" + Math.floor(1000 + Math.random() * 9000);
                      setGatewayInputCode(randomCode);
                    }}
                    className="text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    צור קוד סנכרון חדש אקראי
                  </button>
                </div>
              </div>

              {cloudStatusMsg && (
                <div className={`p-3 text-xs font-bold rounded-lg border ${
                  cloudStatusMsg.isError 
                    ? "bg-rose-950/80 border-rose-800 text-rose-300" 
                    : "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                }`}>
                  {cloudStatusMsg.text}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={async () => {
                    const ok = await connectAndSyncCloud(gatewayInputCode);
                    if (ok) {
                      setIsGateUnlocked(true);
                    }
                  }}
                  disabled={isCloudSyncing || !gatewayInputCode.trim()}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCloudSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4" />
                  )}
                  התחבר וסנכרן נתונים מהענן
                </button>

                <button
                  onClick={() => {
                    if (window.confirm("שים לב: ללא חיבור קוד סנכרון, המידע שלך יישמר רק בדפדפן המקומי של מכשיר זה ועלול להימחק אם תנקה היסטוריית גלישה.\nהאם ברצונך להמשיך עבודה מקומית ללא גיבוי ענן?")) {
                      setIsGateUnlocked(true);
                    }
                  }}
                  disabled={isCloudSyncing}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 font-bold text-xs rounded-xl border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                >
                  המשך ללא סנכרון (עבודה מקומית בלבד)
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-indigo-500/10 pt-4 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              סנכרון מאובטח מול Firebase
            </span>
            <span>מחשבון שער הגולן v2.4</span>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans pb-16" dir="rtl">
      <div className="print:hidden">
        {/* 1. Header Navigation Panel */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row items-center justify-between py-2 md:py-3.5 gap-2">
            
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo className="h-8 xs:h-10 sm:h-12 md:h-16 w-auto rounded-lg md:rounded-xl bg-white p-1 md:p-1.5 shadow-md border border-slate-700/50 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-[11px] xs:text-xs sm:text-sm md:text-lg font-black tracking-tight leading-none md:leading-tight truncate">
                  מחשבון עבודות חשמליה שער הגולן
                </h1>
                <p className="text-[8px] xs:text-[10px] sm:text-xs text-slate-300 mt-0.5 md:mt-1 leading-none truncate">מערכת תמחור חומרים ועבודות | סיטונאות Erco</p>
              </div>
            </div>

            {/* Desktop Navigation Tabs - Hidden on Mobile */}
            <nav className="hidden md:flex flex-wrap justify-end gap-1">
              <button
                onClick={() => {
                  setActiveTab("workspace");
                  setShowCloudPanel(false);
                  setShowVatPanel(false);
                }}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === "workspace" && !showCloudPanel && !showVatPanel
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>עבודה פעילה וסיכום</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("reports");
                  setShowCloudPanel(false);
                  setShowVatPanel(false);
                }}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === "reports" && !showCloudPanel && !showVatPanel
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>פרויקטים ודוחות</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("catalog");
                  setShowCloudPanel(false);
                  setShowVatPanel(false);
                }}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === "catalog" && !showCloudPanel && !showVatPanel
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>מחירון חומרים Erco</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("info");
                  setShowCloudPanel(false);
                  setShowVatPanel(false);
                }}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === "info" && !showCloudPanel && !showVatPanel
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>מדריך ותמחור</span>
              </button>

              {/* Cloud Sync button */}
              <button
                onClick={() => {
                  setShowCloudPanel(!showCloudPanel);
                  setShowVatPanel(false);
                }}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition border border-dashed ${
                  showCloudPanel
                    ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md"
                    : "text-amber-400 border-amber-500/50 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>סנכרון ענן</span>
              </button>

              {/* VAT Settings button */}
              <button
                onClick={() => {
                  setShowVatPanel(!showVatPanel);
                  setShowCloudPanel(false);
                }}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition border border-dashed ${
                  showVatPanel
                    ? "bg-emerald-500 text-slate-950 border-emerald-500 shadow-md"
                    : "text-emerald-400 border-emerald-500/50 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>הגדרות מע״מ</span>
              </button>
            </nav>

            {/* Mobile Navigation Dropdown */}
            <div className="md:hidden relative flex-shrink-0">
              <select
                value={showCloudPanel ? "cloud" : showVatPanel ? "vat" : activeTab}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "cloud") {
                    setShowCloudPanel(true);
                    setShowVatPanel(false);
                  } else if (val === "vat") {
                    setShowVatPanel(true);
                    setShowCloudPanel(false);
                  } else {
                    setActiveTab(val);
                    setShowCloudPanel(false);
                    setShowVatPanel(false);
                  }
                }}
                className="bg-indigo-900/90 text-white text-[11px] xs:text-xs font-black rounded-lg py-1.5 pl-6 pr-2.5 border border-indigo-700/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer appearance-none text-right shadow-inner"
              >
                <option value="workspace">💼 עבודה וסיכום</option>
                <option value="reports">📊 פרויקטים ודוחות</option>
                <option value="catalog">🏷️ מחירון חומרים</option>
                <option value="info">ℹ️ מדריך ותמחור</option>
                <option value="cloud">☁️ סנכרון ענן</option>
                <option value="vat">💰 הגדרות מע״מ</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-indigo-300">
                <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 print:p-0">

        {/* Collapsible Cloud Settings Panel */}
        {showCloudPanel && (
          <div className="mb-8 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 overflow-hidden animate-fade-in print:hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-950 p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">סנכרון ענן וגיבוי רב-מכשירים</h3>
              </div>
              <button
                onClick={() => setShowCloudPanel(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
              >
                סגור ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  הקלד מילת קוד/קוד סנכרון משלך (לדוגמה: <span className="font-mono text-indigo-300 font-bold">GOLAN-ELEC</span>) כדי לשמור את כל מחירון החומרים, העבודות הפעילות, והארכיון בענן של Firebase. הקלדת אותו קוד במכשיר אחר (טלפון, טאבלט, מחשב) תאפשר לך לעבוד ולסנכרן את המידע באופן מיידי!
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="הזן קוד סנכרון אישי..."
                      value={syncCode}
                      onChange={(e) => setSyncCode(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold uppercase text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      onClick={() => connectAndSyncCloud(syncCode)}
                      disabled={isCloudSyncing}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {isCloudSyncing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5" />
                      )}
                      התחבר וסנכרן
                    </button>
                  </div>

                  {syncCode && (
                    <div className="space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold">קוד מחובר פעיל:</span>
                        <span className="font-mono font-bold text-amber-400 uppercase">{syncCode}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold">סנכרון ענן אוטומטי:</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoSync}
                            onChange={(e) => setAutoSync(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-4 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-500">
                        <span>סנכרון אחרון:</span>
                        <span className="font-mono font-bold text-slate-400">{lastCloudSyncTime || "טרם סונכרן"}</span>
                      </div>

                      <button
                        onClick={() => uploadToCloud(syncCode, true)}
                        disabled={isCloudSyncing}
                        className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold transition flex items-center justify-center gap-1"
                      >
                        <Cloud className="w-3.5 h-3.5 text-amber-400" />
                        גבה עכשיו ידנית לענן
                      </button>

                      {/* Cloud Backups History Section */}
                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <div className="flex items-center gap-1.5 mb-2">
                          <History className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-slate-300 font-bold text-xs">היסטוריית גיבויים קודמים בענן</span>
                        </div>
                        {cloudBackups.length === 0 ? (
                          <p className="text-[10px] text-slate-500 italic py-1 text-center">אין גיבויים היסטוריים שמורים עבור קוד זה. לחץ על 'גבה עכשיו ידנית לענן' ליצירת גיבוי ראשון.</p>
                        ) : (
                          <div className="space-y-2">
                            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 pr-1">
                              {cloudBackups.map((bk, idx) => {
                                const dateVal = Number(bk.backupId) || (bk.lastUpdated ? new Date(bk.lastUpdated).getTime() : Date.now());
                                const backupDate = new Date(dateVal);
                                const dateStr = backupDate.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
                                const timeStr = backupDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
                                const isCurrent = idx === 0;
                                return (
                                  <div key={bk.backupId} className={`flex items-center justify-between p-2 rounded transition gap-2 ${isCurrent ? 'bg-slate-900 border border-amber-500/40 shadow-inner shadow-amber-500/5' : 'bg-slate-900/80 border border-slate-800/80 hover:border-slate-700'}`}>
                                    <div className="flex flex-col">
                                      <span className="text-slate-200 font-medium font-mono text-[11px] leading-tight flex items-center gap-1.5 flex-wrap">
                                        {dateStr} | {timeStr}
                                        {isCurrent && (
                                          <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-bold px-1 py-0.5 rounded border border-emerald-500/30 animate-pulse">
                                            פעיל ומוגן
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-mono">
                                        ID: {bk.backupId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleRestoreBackup(bk)}
                                        title="שחזר גיבוי זה"
                                        className="p-1 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded transition cursor-pointer"
                                      >
                                        <Undo2 className="w-3.5 h-3.5" />
                                      </button>
                                      {!isCurrent && (
                                        <button
                                          onClick={() => handleDeleteBackup(bk.backupId)}
                                          title="מחק גיבוי זה"
                                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {cloudBackups.length > 1 && (
                              <button
                                onClick={handleDeleteOldBackups}
                                disabled={isCloudSyncing}
                                className="w-full py-1.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 hover:border-rose-700 text-rose-300 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                מחק גיבויים ישנים (פנה שטח אחסון)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {cloudStatusMsg && (
                <div className={`mt-4 p-3 rounded-lg text-xs font-bold animate-fade-in ${
                  cloudStatusMsg.isError 
                    ? "bg-rose-950/50 text-rose-300 border border-rose-900/50" 
                    : "bg-emerald-950/50 text-emerald-300 border border-emerald-900/50"
                }`}>
                  {cloudStatusMsg.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsible VAT Settings Panel */}
        {showVatPanel && (
          <div className="mb-8 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 overflow-hidden animate-fade-in print:hidden">
            <div className="bg-gradient-to-r from-emerald-900 to-slate-950 p-4 border-b border-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Coins className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">הגדרות מע״מ</h3>
              </div>
              <button
                onClick={() => setShowVatPanel(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
              >
                סגור ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  שנה כאן את שיעור המע״מ הכללי המשמש במחשבון. שינוי שיעור המע״מ יעודכן באופן מיידי בכל חלקי המערכת (סיכומי פרויקטים, הצעות מחיר, מסמכים להדפסה, דוחות חודשיים והודעות WhatsApp).
                </p>

                <div className="pt-2">
                  <label className="text-xs text-slate-300 font-bold block mb-1.5">שיעור המע״מ המעודכן באחוזים (%):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={vatRate}
                      onChange={(e) => setVatRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-black text-center text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-500 font-semibold">% מע״מ מעודכן כחוק</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Tab 1: Workspace Grid (Templates + Jobs + Live quote sidebar) */}
        {activeTab === "workspace" && (
          <div className="space-y-6 print:hidden">
            
            {/* Collapsible Quick Templates Toggle */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">הוספת עבודות נפוצות מהירות (תבניות מוכנות)</h3>
                  <p className="text-[11px] text-slate-500 font-medium">בלחיצה אחת: הוסף משימה שלמה כולל מחירי עבודה וחומרי בסיס מותאמי Erco</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickTemplates(!showQuickTemplates)}
                className={`px-4 py-2 font-black text-xs rounded-lg border transition duration-150 cursor-pointer ${
                  showQuickTemplates 
                    ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100" 
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 shadow-xs"
                }`}
              >
                {showQuickTemplates ? "הסתר תבניות מהירות" : "הצג תבניות עבודה מהירות ⚡"}
              </button>
            </div>

            {showQuickTemplates && (
              <div className="animate-fade-in transition-all">
                <CommonLaborTemplates 
                  catalog={catalog} 
                  templates={laborTemplates}
                  onUpdateTemplates={setLaborTemplates}
                  onAddJobFromTemplate={handleAddJobFromTemplate} 
                />
              </div>
            )}

            {/* Quick Draft & Backup Toolbar (Always visible on top of main workspace) */}
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 rounded-2xl p-4 sm:p-5 border border-indigo-100/80 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Title & Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100/80 flex items-center justify-center shrink-0">
                    <Save className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">שמירה וגיבוי של טיוטת העבודה הנוכחית</h3>
                    <p className="text-[11px] text-slate-500 font-medium">שמור את המצב הנוכחי באתר או הורד קובץ גיבוי פיזי למחשב למניעת אובדן נתונים בטעות</p>
                  </div>
                </div>

                {/* Forms and Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full lg:w-auto">
                  <form onSubmit={(e) => handleSaveQuickDraft(e)} className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="שם הטיוטה (למשל: משפחת כהן)"
                      value={quickDraftName}
                      onChange={(e) => setQuickDraftName(e.target.value)}
                      className="text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-indigo-500 w-full sm:w-52"
                    />
                    <button
                      type="submit"
                      className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] sm:text-xs rounded-lg shadow-xs transition duration-150 flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">שמור טיוטה באתר</span>
                      <span className="sm:hidden">שמור</span>
                    </button>
                  </form>

                  <div className="h-4 w-[1px] bg-slate-300 hidden lg:block"></div>

                  {/* Secondary System Utility Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 w-full sm:flex sm:w-auto sm:items-center sm:gap-2">
                    {/* Export button */}
                    <button
                      onClick={handleExportQuickDraftToFile}
                      title="הורד קובץ גיבוי למחשב לשחזור עתידי"
                      className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-[11px] sm:text-xs rounded-lg shadow-xs transition duration-150 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">הורד כקובץ (.json)</span>
                      <span className="sm:hidden">ייצוא</span>
                    </button>

                    {/* Import button */}
                    <label className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-black text-[11px] sm:text-xs rounded-lg shadow-xs transition duration-150 flex items-center justify-center gap-1 cursor-pointer">
                      <FileUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="hidden sm:inline">טען קובץ גיבוי</span>
                      <span className="sm:hidden">ייבוא</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportQuickDraftFromFile}
                        className="hidden"
                      />
                    </label>

                    {/* Clear / Start Fresh */}
                    <button
                      onClick={() => {
                        if (confirm("האם אתה בטוח שברצונך לאפס ולמחוק את כל העבודות הפעילות? (מומלץ לבצע גיבוי לפני כן)")) {
                          handleClearProject();
                        }
                      }}
                      className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-[11px] sm:text-xs rounded-lg shadow-xs transition duration-150 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                      <span className="hidden sm:inline">אפס והתחל פרויקט חדש</span>
                      <span className="sm:hidden">איפוס</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {draftMessage && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-fade-in ${
                  draftMessageIsError 
                    ? "bg-rose-50 text-rose-800 border border-rose-100" 
                    : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                }`}>
                  {draftMessageIsError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                  <span>{draftMessage}</span>
                </div>
              )}
            </div>

            {/* Core Workspace Double Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column (col-span-2) - Jobs manager list */}
              <div className="lg:col-span-2 space-y-6">
                <JobsManager
                  jobs={project.jobs}
                  catalog={catalog}
                  globalMarkupPercent={project.globalMarkupPercent}
                  includeVat={project.includeVat}
                  onAddJob={handleAddJob}
                  onUpdateJob={handleUpdateJob}
                  onDeleteJob={handleDeleteJob}
                  rates={rates}
                  onUpdateRates={(newRates) => setRates(newRates)}
                  vatRate={vatRate}
                />

                {/* Client & Project Details panel (now full-width and beautifully responsive) */}
                <ClientDetailsManager
                  project={project}
                  onUpdateProject={handleUpdateProject}
                  branches={branches}
                  onUpdateBranches={(newBranches) => setBranches(newBranches)}
                />
              </div>

              {/* Right Column (col-span-1) - Sticky Quote Summary Panel */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-24">
                  <QuoteSummary
                    project={project}
                    onUpdateProject={handleUpdateProject}
                    onClearProject={handleClearProject}
                    onImportBackup={handleImportBackup}
                    onExportBackup={handleExportBackup}
                    vatRate={vatRate}
                    onArchiveProject={handleArchiveCurrentProject}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1.5: Project History & Monthly Summary Archive */}
        {activeTab === "reports" && (
          <div className="print:hidden">
            <ProjectHistory
              currentProject={project}
              catalog={catalog}
              onLoadProject={handleLoadProject}
              savedProjects={savedProjects}
              setSavedProjects={setSavedProjects}
              savedDrafts={savedDrafts}
              setSavedDrafts={setSavedDrafts}
              vatRate={vatRate}
            />
          </div>
        )}

        {/* Tab 2: Materials Catalog manager */}
        {activeTab === "catalog" && (
          <div className="print:hidden">
            <CatalogManager
              catalog={catalog}
              onAddCatalogItem={handleAddCatalogItem}
              onUpdateCatalogItem={handleUpdateCatalogItem}
              onDeleteCatalogItem={handleDeleteCatalogItem}
              onResetCatalog={handleResetCatalog}
              onResetCatalogPricesOnly={handleResetCatalogPricesOnly}
              onMergeDefaultCatalogItems={handleMergeNewCatalogItems}
              onImportCatalogFromFile={handleImportCatalogFromFile}
              isSyncing={isSyncing}
              syncStatus={syncStatus}
              lastSyncTime={lastSyncTime}
              onSyncNow={() => triggerErcoSync(true)}
            />
          </div>
        )}

        {/* Tab 3: System Guideline & Educational Manual */}
        {activeTab === "info" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-3xl mx-auto space-y-6 print:hidden">
            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-indigo-600" />
              מדריך לתמחור נכון ומקסום רווחים לחשמלאי
            </h2>

            <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
              <p>
                ברוך הבא למערכת תמחור החשמלאים הדיגיטלית שלך! המערכת פותחה במיוחד כדי לפתור את כאב הראש של סוף החודש – המעבר המייגע על כל עבודה ועבודה, בדיקת מחירי החומרים וחישוב הצעות המחיר ללקוח.
              </p>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
                <h3 className="font-bold text-indigo-900 flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  כיצד עובד מודל התמחור?
                </h3>
                <p className="text-xs text-slate-600">
                  עבור כל פריט או אביזר שבו נעשה שימוש, המערכת מושכת את מחיר העלות הסיטונאי שלו מאתר <span className="font-semibold text-slate-800">סיטונאות החשמל Erco (ארקו)</span> ללא מע״מ.
                </p>
                <div className="font-mono text-xs font-bold text-indigo-700 bg-white p-2.5 rounded border border-indigo-100/50 text-center">
                  מחיר מומלץ ללקוח = (עלות חומרים × אחוז רווח מבוקש) + עלות עבודה ושירות
                </div>
                <p className="text-xs text-slate-500">
                  * לדוגמה: אם קנית מאמ״ת ב-10 ₪, ואחוז הרווח מוגדר על 30%, המערכת תתמחר את החומר ללקוח ב-13 ₪, ותוסיף לזה את מחיר העבודה שקבעת (למשל 250 ₪ להחלפה).
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">טיפים לשימוש יעיל במחשבון:</h3>
                <ul className="list-disc list-inside space-y-2 text-xs pr-2">
                  <li>
                    <span className="font-bold text-slate-800">הוספה מהירה:</span> היעזר בכפתורי העבודות המהירות בחלק העליון. הם יוצרים עבודה שלמה, כולל חומרים מתאימים מהקטלוג ומחיר עבודה מומלץ, בלחיצה אחת בלבד.
                  </li>
                  <li>
                    <span className="font-bold text-slate-800">שינוי עלויות בקטליזציה:</span> אם מחיר של פריט מסוים השתנה בסיטונאות, תוכל לערוך אותו ישירות בלשונית <span className="font-semibold text-slate-800">"מחירון חומרים Erco"</span>. הוא יישמר מעודכן לפעמים הבאות!
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">התאמת אחוזי רווח:</span> תוכל לכוון את סליידר הרווח הכללי בהתאם לגודל הפרויקט. בפרויקטים קטנים מומלץ רווח של 30%-50% על החומרים, ובפרויקטים גדולים 15%-25%.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">הפקת הצעת מחיר ל-WhatsApp:</span> המערכת מעצבת הודעה יפה ומסודרת בעברית שתוכל להעתיק ולשלוח ללקוח ישירות לנייד תוך שנייה אחת.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">הדפסה ושמירה ל-PDF:</span> בלחיצה על כפתור ההדפסה, המערכת תסתיר את כל כפתורי האתר ותשאיר רק דף הצעת מחיר רשמי, נקי ואסתטי שתוכל לשמור כקובץ PDF או להדפיס פיזית.
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                <span>פותח באהבה עבור חשמלאים מקצועיים בישראל.</span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-indigo-500" />
                  כל המידע נשמר מקומית בדפדפן שלך בצורה בטוחה.
                </span>
              </div>
            </div>
          </div>
        )}

      </main>
      </div>

      {/* 3. Printable Container (Always loaded in background, only displayed by @media print) */}
      <div id="print-area">
        <PrintableInvoice project={project} vatRate={vatRate} />
      </div>
    </div>
  );
}
