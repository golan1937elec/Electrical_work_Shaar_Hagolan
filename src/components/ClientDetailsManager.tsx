import React, { useState, useEffect } from "react";
import { Project } from "../types";
import { User, Phone, Calendar, Layers, Settings, Plus, Trash2, X, RotateCcw, MapPin, Search, Check, Save, Pencil } from "lucide-react";

interface ClientDetailsManagerProps {
  project: Project;
  onUpdateProject: (updatedProject: Project) => void;
  branches: string[];
  onUpdateBranches: (newBranches: string[]) => void;
  savedContacts: { id: string; name: string; phone: string; branch?: string; address?: string }[];
  onUpdateSavedContacts: (newContacts: { id: string; name: string; phone: string; branch?: string; address?: string }[]) => void;
}

export const DEFAULT_BRANCHES = [
  "בית הדר",
  "בית ירח",
  "בננות",
  "גד\"ש",
  "חברים",
  "חדר אוכל",
  "כלבו",
  "לול",
  "מוזיאון",
  "מזכירות",
  "מסגריה",
  "מקלטים",
  "משק ילדים",
  "נוי",
  "רפת",
  "שכירויות",
  "תאורת גדר",
  "תאורת חצר",
  "תיירות"
];

export default function ClientDetailsManager({
  project,
  onUpdateProject,
  branches,
  onUpdateBranches,
  savedContacts = [],
  onUpdateSavedContacts,
}: ClientDetailsManagerProps) {
  const { clientName = "", clientPhone = "", projectAddress = "", branch = "", date = "" } = project;

  const [selectValue, setSelectValue] = useState(() => {
    if (!branch) return "";
    if (branches.includes(branch)) return branch;
    return "custom";
  });

  const [customValue, setCustomValue] = useState(() => {
    if (!branch) return "";
    if (branches.includes(branch)) return "";
    return branch;
  });

  // Manage Branches Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Saved Contacts Modal State
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactBranch, setNewContactBranch] = useState("");
  const [newContactAddress, setNewContactAddress] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactError, setContactError] = useState("");

  // Keep state synced with parent updates
  useEffect(() => {
    if (!branch) {
      setSelectValue("");
      setCustomValue("");
    } else if (branches.includes(branch)) {
      setSelectValue(branch);
      setCustomValue("");
    } else {
      setSelectValue("custom");
      setCustomValue(branch);
    }
  }, [branch, branches]);

  const handleUpdateField = (field: keyof Project, value: any) => {
    onUpdateProject({
      ...project,
      [field]: value,
    });
  };

  const handleSelectChange = (val: string) => {
    setSelectValue(val);
    if (val === "custom") {
      onUpdateProject({
        ...project,
        branch: customValue,
      });
    } else {
      onUpdateProject({
        ...project,
        branch: val,
      });
    }
  };

  const handleCustomBranchChange = (val: string) => {
    setCustomValue(val);
    onUpdateProject({
      ...project,
      branch: val,
    });
  };

  // Branch list modification functions
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanValue = newBranchInput.trim();
    if (!cleanValue) return;

    if (branches.includes(cleanValue)) {
      setErrorMsg("ענף זה כבר קיים ברשימה");
      return;
    }

    const updated = [...branches, cleanValue].sort((a, b) => a.localeCompare(b, "he"));
    onUpdateBranches(updated);
    setNewBranchInput("");
    setErrorMsg("");
  };

  const handleRemoveBranch = (branchToRemove: string) => {
    const updated = branches.filter((b) => b !== branchToRemove);
    onUpdateBranches(updated);

    // If the currently selected branch was removed, switch select value back to empty or custom
    if (branch === branchToRemove) {
      onUpdateProject({
        ...project,
        branch: "",
      });
    }
  };

  const handleResetBranches = () => {
    if (window.confirm("האם אתה בטוח שברצונך לשחזר את רשימת הענפים המקורית?")) {
      onUpdateBranches(DEFAULT_BRANCHES);
      setErrorMsg("");
    }
  };

  // Saved Contacts action functions
  const handleStartEditContact = (contact: typeof savedContacts[0]) => {
    setEditingContactId(contact.id);
    setNewContactName(contact.name);
    setNewContactPhone(contact.phone);
    setNewContactBranch(contact.branch || "");
    setNewContactAddress(contact.address || "");
    setContactError("");
  };

  const handleCancelEditContact = () => {
    setEditingContactId(null);
    setNewContactName("");
    setNewContactPhone("");
    setNewContactBranch("");
    setNewContactAddress("");
    setContactError("");
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newContactName.trim();
    const phone = newContactPhone.trim();
    const branchVal = newContactBranch.trim();
    const address = newContactAddress.trim();

    if (!name) {
      setContactError("שם איש הקשר הוא חובה");
      return;
    }

    if (editingContactId) {
      const updatedContacts = savedContacts.map((c) =>
        c.id === editingContactId
          ? {
              ...c,
              name,
              phone,
              branch: branchVal || undefined,
              address: address || undefined,
            }
          : c
      );
      onUpdateSavedContacts(updatedContacts);
      handleCancelEditContact();
    } else {
      const newContact = {
        id: "contact-" + Math.random().toString(36).substr(2, 9),
        name,
        phone,
        branch: branchVal || undefined,
        address: address || undefined,
      };

      onUpdateSavedContacts([newContact, ...savedContacts]);
      setNewContactName("");
      setNewContactPhone("");
      setNewContactBranch("");
      setNewContactAddress("");
      setContactError("");
    }
  };

  const handleRemoveContact = (id: string) => {
    onUpdateSavedContacts(savedContacts.filter((c) => c.id !== id));
    if (editingContactId === id) {
      handleCancelEditContact();
    }
  };

  const handleSaveCurrentAsContact = () => {
    if (!clientName.trim()) {
      alert("אנא הזן שם לקוח תחילה כדי לשמור אותו כאיש קשר");
      return;
    }
    
    // Check if name already exists
    const exists = savedContacts.some(
      (c) => c.name.trim().toLowerCase() === clientName.trim().toLowerCase()
    );
    if (exists) {
      alert("איש קשר בשם זה כבר קיים ברשימה!");
      return;
    }

    const newContact = {
      id: "contact-" + Math.random().toString(36).substr(2, 9),
      name: clientName.trim(),
      phone: clientPhone || "",
      branch: branch || undefined,
      address: projectAddress || undefined,
    };

    onUpdateSavedContacts([newContact, ...savedContacts]);
    alert(`איש הקשר "${clientName.trim()}" נשמר בהצלחה!`);
  };

  const handleSelectContact = (contact: typeof savedContacts[0]) => {
    onUpdateProject({
      ...project,
      clientName: contact.name,
      clientPhone: contact.phone,
      branch: contact.branch || branch || "",
      projectAddress: contact.address || "",
    });
    setIsContactsModalOpen(false);
  };

  const filteredContacts = savedContacts.filter((c) => {
    const term = contactSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term) ||
      (c.branch && c.branch.toLowerCase().includes(term)) ||
      (c.address && c.address.toLowerCase().includes(term))
    );
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-indigo-100/75 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <User className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm">פרטי הפרויקט והענף</h3>
            <p className="text-[10px] text-slate-400">הזן פרטי זיהוי ובחר ענף עבור הצעת המחיר</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Saved Contacts Button */}
          <button
            type="button"
            onClick={() => setIsContactsModalOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1.5 transition"
          >
            <User className="w-3.5 h-3.5 text-indigo-600" />
            אנשי קשר שמורים ({savedContacts.length})
          </button>

          {/* Manage branches button */}
          <button
            type="button"
            onClick={() => setIsManageModalOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 transition"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            ניהול רשימת ענפים
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Client Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 text-right">שם הלקוח</label>
          <div className="relative w-full">
            <input
              id="client-name-input"
              type="text"
              placeholder="למשל: משפחת כהן"
              value={clientName}
              onChange={(e) => handleUpdateField("clientName", e.target.value)}
              className="w-full text-xs px-3 py-2 pr-9 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-slate-50/20 font-bold"
            />
            <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-[10px]" />
          </div>
        </div>

        {/* Client Phone */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 text-right">טלפון לקוח</label>
          <div className="relative w-full">
            <input
              id="client-phone-input"
              type="text"
              placeholder="למשל: 050-1234567"
              value={clientPhone || ""}
              onChange={(e) => handleUpdateField("clientPhone", e.target.value)}
              className="w-full text-xs px-3 py-2 pr-9 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-slate-50/20"
            />
            <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-[10px]" />
          </div>
        </div>

        {/* Branch / ענף */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 text-right">ענף</label>
          <div className="flex flex-col gap-2">
            <div className="relative w-full">
              <select
                id="branch-select"
                value={selectValue}
                onChange={(e) => handleSelectChange(e.target.value)}
                className="w-full text-xs px-3 py-2 pr-9 pl-8 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-slate-50/20 font-bold text-slate-700 appearance-none"
              >
                <option value="">בחר ענף</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="custom">✍️ הקלדה חופשית (ענף אחר)</option>
              </select>
              <Layers className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-[10px] pointer-events-none" />
              <div className="absolute left-3 top-2.5 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {selectValue === "custom" && (
              <div className="relative w-full">
                <input
                  id="custom-branch-input"
                  type="text"
                  placeholder="הקלד שם ענף אחר..."
                  value={customValue}
                  onChange={(e) => handleCustomBranchChange(e.target.value)}
                  className="w-full text-xs px-3 py-2 pr-9 border border-indigo-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-indigo-50/10 font-bold text-indigo-950"
                />
                <span className="absolute right-3 top-2 text-indigo-400 font-bold text-xs">✎</span>
              </div>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 text-right">תאריך פתיחה</label>
          <div className="relative w-full">
            <input
              id="project-date-input"
              type="date"
              value={date}
              onChange={(e) => handleUpdateField("date", e.target.value)}
              className="w-full text-xs px-3 py-2 pr-9 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-slate-50/20"
            />
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-[10px]" />
          </div>
        </div>
      </div>

      {/* Modal - Saved Contacts */}
      {isContactsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden" dir="rtl">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-base">אנשי קשר שמורים למילוי מהיר</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsContactsModalOpen(false);
                  handleCancelEditContact();
                }}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Content */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 grid grid-cols-1 md:grid-cols-5 gap-6">
              {/* Left Column: List (col-span-3) */}
              <div className="md:col-span-3 space-y-3 flex flex-col h-full">
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="חפש לפי שם, טלפון או כתובת..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="bg-transparent border-none text-xs w-full focus:outline-none focus:ring-0"
                  />
                  {contactSearch && (
                    <button
                      type="button"
                      onClick={() => setContactSearch("")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto max-h-[40vh] md:max-h-[50vh] space-y-2 pr-1">
                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 space-y-1">
                      <User className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                      <p className="text-xs font-semibold">לא נמצאו אנשי קשר</p>
                      <p className="text-[10px]">הקלד שם בחיפוש או הוסף איש קשר חדש משמאל</p>
                    </div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`flex flex-col p-3 border rounded-xl transition group relative ${
                          editingContactId === contact.id
                            ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-200"
                            : "bg-slate-50 hover:bg-indigo-50/40 border-slate-100"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-slate-800 text-xs block">{contact.name}</span>
                            {contact.phone && (
                              <span className="text-[11px] text-slate-500 block font-mono mt-0.5">{contact.phone}</span>
                            )}
                            {contact.branch && (
                              <span className="text-[11px] text-indigo-600 font-bold block mt-0.5">🏷️ {contact.branch}</span>
                            )}
                            {contact.address && (
                              <span className="text-[11px] text-slate-400 block mt-0.5">📍 {contact.address}</span>
                            )}
                          </div>
                          
                          <div className="flex gap-1.5 items-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSelectContact(contact)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-2.5 py-1 rounded-md transition flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              בחר
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditContact(contact)}
                              className={`p-1 rounded transition ${
                                editingContactId === contact.id
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "text-slate-400 hover:text-indigo-600 hover:bg-slate-200"
                              }`}
                              title="ערוך איש קשר"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveContact(contact.id)}
                              className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-200 transition"
                              title="מחק איש קשר"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Add/Edit Contact form (col-span-2) */}
              <div className="md:col-span-2 space-y-4 border-t md:border-t-0 md:border-r border-slate-100 pt-5 md:pt-0 md:pr-5">
                <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  {editingContactId ? (
                    <span className="text-indigo-600 font-black">📝 עריכת איש קשר</span>
                  ) : (
                    <span>➕ הוספת איש קשר חדש</span>
                  )}
                </h5>
                <form onSubmit={handleAddContact} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600">שם איש קשר *</label>
                    <input
                      type="text"
                      value={newContactName}
                      onChange={(e) => {
                        setNewContactName(e.target.value);
                        setContactError("");
                      }}
                      placeholder="למשל: משה כהן"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600">מספר טלפון</label>
                    <input
                      type="text"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder="למשל: 052-1234567"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600">ענף (אופציונלי)</label>
                    <input
                      type="text"
                      value={newContactBranch}
                      onChange={(e) => setNewContactBranch(e.target.value)}
                      placeholder="למשל: בית הדר, בננות"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600">כתובת (אופציונלי)</label>
                    <input
                      type="text"
                      value={newContactAddress}
                      onChange={(e) => setNewContactAddress(e.target.value)}
                      placeholder="למשל: הרצל 15, תל אביב"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {contactError && (
                    <p className="text-[10px] text-red-500 font-bold">{contactError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 transition"
                    >
                      {editingContactId ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          שמור שינויים
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          הוסף לרשימה
                        </>
                      )}
                    </button>
                    {editingContactId && (
                      <button
                        type="button"
                        onClick={handleCancelEditContact}
                        className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 rounded-lg transition"
                      >
                        ביטול
                      </button>
                    )}
                  </div>
                </form>

                <div className="border-t border-slate-100 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={handleSaveCurrentAsContact}
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] py-2 rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-600" />
                    שמור לקוח נוכחי כאיש קשר
                  </button>
                  <p className="text-[9px] text-slate-400 text-center mt-1.5">
                    יוצר איש קשר חדש מהנתונים שמולאו כעת בטופס הראשי
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsContactsModalOpen(false);
                  handleCancelEditContact();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Manage Branches */}
      {isManageModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden" dir="rtl">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-base">ניהול רשימת הענפים</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageModalOpen(false);
                  setErrorMsg("");
                }}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content & List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Form to Add New Branch */}
              <form onSubmit={handleAddBranch} className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">הוספת ענף חדש לרשימה:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBranchInput}
                    onChange={(e) => {
                      setNewBranchInput(e.target.value);
                      setErrorMsg("");
                    }}
                    placeholder="הקלד שם ענף (למשל: מחסן טכני)"
                    className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 transition shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    הוסף ענף
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-[11px] text-red-500 font-bold">{errorMsg}</p>
                )}
              </form>

              {/* Current List Header */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-600">רשימת ענפים קיימת ({branches.length}):</span>
                <button
                  type="button"
                  onClick={handleResetBranches}
                  className="text-[10px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition"
                  title="שחזר רשימת ברירת מחדל"
                >
                  <RotateCcw className="w-3 h-3" />
                  שחזר ברירת מחדל
                </button>
              </div>

              {/* Scrollable list of existing branches */}
              <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-1">
                {branches.map((b) => (
                  <div
                    key={b}
                    className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs hover:bg-slate-100/80 transition"
                  >
                    <span className="font-semibold text-slate-800 truncate">{b}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBranch(b)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-white transition"
                      title={`מחק את ענף ${b}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsManageModalOpen(false);
                  setErrorMsg("");
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
