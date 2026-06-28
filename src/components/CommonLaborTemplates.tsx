/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CommonLaborPrice, CatalogItem, LABOR_CATEGORIES } from "../types";
import { Sparkles, Plus, Info, Pencil, Trash2, X, Check, Search, AlertCircle, RefreshCw } from "lucide-react";

interface CommonLaborTemplatesProps {
  catalog: CatalogItem[];
  templates: CommonLaborPrice[];
  onUpdateTemplates: (newTemplates: CommonLaborPrice[]) => void;
  onAddJobFromTemplate: (template: CommonLaborPrice) => void;
}

export default function CommonLaborTemplates({
  catalog,
  templates = [],
  onUpdateTemplates,
  onAddJobFromTemplate,
}: CommonLaborTemplatesProps) {
  // Search & Filter templates state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("הכל");

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formTitle, setFormTitle] = useState("");
  const [formCost, setFormCost] = useState<number>(200);
  const [formCategory, setFormCategory] = useState(Object.values(LABOR_CATEGORIES)[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  
  const [formMaterials, setFormMaterials] = useState<{ sku: string; quantity: number }[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");

  // Categories list for templates
  const allCategories = ["הכל", ...Array.from(new Set(templates.map((t) => t.category)))];

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "הכל" || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Material search filtering
  const filteredCatalogItems = materialSearch.trim() === "" 
    ? [] 
    : catalog.filter(item => 
        item.name.toLowerCase().includes(materialSearch.toLowerCase()) || 
        item.sku.includes(materialSearch) || 
        (item.brand && item.brand.toLowerCase().includes(materialSearch.toLowerCase()))
      ).slice(0, 5);

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFormCost(200);
    setFormCategory(Object.values(LABOR_CATEGORIES)[0]);
    setIsCustomCategory(false);
    setCustomCategory("");
    setFormMaterials([]);
    setMaterialSearch("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (template: CommonLaborPrice, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering onAddJobFromTemplate
    setEditingId(template.id);
    setFormTitle(template.title);
    setFormCost(template.defaultLaborCost);
    
    const standardCategories = Object.values(LABOR_CATEGORIES);
    if (standardCategories.includes(template.category)) {
      setFormCategory(template.category);
      setIsCustomCategory(false);
    } else {
      setFormCategory("custom");
      setIsCustomCategory(true);
      setCustomCategory(template.category);
    }
    
    setFormMaterials(template.suggestedMaterials ? [...template.suggestedMaterials] : []);
    setMaterialSearch("");
    setIsFormOpen(true);
  };

  const handleRemoveTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering onAddJobFromTemplate
    if (window.confirm("האם אתה בטוח שברצונך למחוק תבנית עבודה זו?")) {
      const updated = templates.filter((t) => t.id !== id);
      onUpdateTemplates(updated);
    }
  };

  const handleAddMaterialToForm = (item: CatalogItem) => {
    // Check if already exists
    const exists = formMaterials.find(m => m.sku === item.sku);
    if (exists) {
      setFormMaterials(formMaterials.map(m => m.sku === item.sku ? { ...m, quantity: m.quantity + 1 } : m));
    } else {
      setFormMaterials([...formMaterials, { sku: item.sku, quantity: 1 }]);
    }
    setMaterialSearch("");
  };

  const handleUpdateMaterialQty = (sku: string, amount: number) => {
    setFormMaterials(formMaterials.map(m => {
      if (m.sku === sku) {
        const newQty = Math.max(1, m.quantity + amount);
        return { ...m, quantity: newQty };
      }
      return m;
    }));
  };

  const handleRemoveMaterialFromForm = (sku: string) => {
    setFormMaterials(formMaterials.filter(m => m.sku !== sku));
  };

  const handleSave = () => {
    if (!formTitle.trim()) {
      alert("נא להזין שם עבודה/תבנית");
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : formCategory;
    if (!finalCategory.trim()) {
      alert("נא להזין או לבחור קטגוריה");
      return;
    }

    const templateData: CommonLaborPrice = {
      id: editingId || `l_custom_${Math.random().toString(36).substr(2, 9)}`,
      title: formTitle.trim(),
      defaultLaborCost: Number(formCost) || 0,
      category: finalCategory,
      suggestedMaterials: formMaterials,
    };

    if (editingId) {
      // Edit
      const updated = templates.map(t => t.id === editingId ? templateData : t);
      onUpdateTemplates(updated);
    } else {
      // Add
      onUpdateTemplates([templateData, ...templates]);
    }

    setIsFormOpen(false);
    setEditingId(null);
  };

  return (
    <div id="templates-section" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
          <h3 className="font-bold text-slate-900 text-lg">ניהול ותבניות עבודות מהירות</h3>
        </div>
        
        <button
          onClick={handleOpenAddForm}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-100"
        >
          <Plus className="w-4 h-4" />
          <span>הוסף תבנית עבודה חדשה</span>
        </button>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
        כאן תוכל לנהל, להוסיף, לערוך ולמחוק תבניות של עבודות נפוצות. לחיצה על תבנית תוסיף אותה מיד לרשימת העבודות הפעילות כולל מחיר העבודה וחומרי הבסיס המותאמים אישית שקבעת!
      </p>

      {/* Editor/Add Form (Inline Panel) */}
      {isFormOpen && (
        <div className="bg-slate-50 border border-indigo-100 rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h4 className="font-bold text-sm text-indigo-900">
              {editingId ? "עריכת תבנית עבודה" : "יצירת תבנית עבודה חדשה"}
            </h4>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">שם העבודה / תיאור התבנית</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="לדוגמה: התקנת פחת תלת-פזי בלוח"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Default Labor Cost */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">מחיר עבודה מומלץ (ש״ח ללא מע״מ)</label>
              <input
                type="number"
                value={formCost}
                onChange={(e) => setFormCost(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="250"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Category selection */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">קטגוריית עבודה</label>
              <div className="flex gap-2">
                {!isCustomCategory ? (
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setIsCustomCategory(true);
                        setCustomCategory("");
                      } else {
                        setFormCategory(e.target.value);
                      }
                    }}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
                  >
                    {Object.values(LABOR_CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="custom">✍️ קטגוריה מותאמת אישית...</option>
                  </select>
                ) : (
                  <div className="flex-1 flex gap-1">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="הזן קטגוריה מותאמת..."
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => {
                        setIsCustomCategory(false);
                        setFormCategory(Object.values(LABOR_CATEGORIES)[0]);
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 rounded-lg text-xs font-bold"
                      title="חזור לבחירה מרשימה"
                    >
                      בטל
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Suggested Materials Search & Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">חומרי בסיס מומלצים המשוייכים לתבנית זו</span>
              <span className="text-[10px] text-slate-400 font-medium">החומרים יתווספו אוטומטית לעבודה יחד עם מחיר העבודה</span>
            </div>

            {/* Selected materials list */}
            {formMaterials.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 font-medium border border-dashed border-slate-100 rounded-lg">
                לא נבחרו חומרים עבור תבנית זו. העבודה תתווסף ללא חומרי ברירת מחדל.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {formMaterials.map((fm) => {
                  const catItem = catalog.find((item) => item.sku === fm.sku);
                  return (
                    <div key={fm.sku} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{catItem?.name || `מוצר מק"ט ${fm.sku}`}</span>
                        <span className="text-[10px] text-slate-400">מק"ט: {fm.sku} {catItem?.brand ? `| מותג: ${catItem.brand}` : ""}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateMaterialQty(fm.sku, -1)}
                            className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-bold text-slate-800">{fm.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateMaterialQty(fm.sku, 1)}
                            className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveMaterialFromForm(fm.sku)}
                          className="text-rose-500 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition"
                          title="הסר מוצר מהרשימה"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Material Search Input */}
            <div className="relative pt-2 border-t border-slate-100">
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="חפש חומרי גלם בקטלוג (לפי שם או מק״ט) לשיוך לתבנית..."
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-3 py-1.5 text-xs font-semibold focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />

              {/* Suggestions dropdown */}
              {filteredCatalogItems.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 overflow-hidden divide-y divide-slate-100 text-xs">
                  {filteredCatalogItems.map((item) => {
                    const alreadyAdded = formMaterials.some(fm => fm.sku === item.sku);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleAddMaterialToForm(item)}
                        className="p-2.5 hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{item.name}</span>
                          <span className="text-[10px] text-slate-400">מק"ט: {item.sku} {item.brand ? `| מותג: ${item.brand}` : ""} | מחיר: ₪{item.costPrice}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${alreadyAdded ? "bg-amber-100 text-amber-800" : "bg-indigo-50 text-indigo-700"}`}>
                          {alreadyAdded ? "כבר נוסף (הוסף עוד 1)" : "שייך לתבנית +"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-100"
            >
              <Check className="w-4 h-4" />
              <span>שמור תבנית עבודה</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar for templates list */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100/60">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="חפש תבנית עבודה..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pr-9 pl-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Categories slider */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {allCategories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition cursor-pointer ${
                selectedCategory === category
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Custom & Standard Templates */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="font-bold text-sm">לא נמצאו תבניות עבודה תואמות לחיפוש או לסינון שבחרת</p>
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("הכל");
            }}
            className="text-xs text-indigo-600 font-bold hover:underline"
          >
            אפס סינון וחיפוש
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const materialsCount = template.suggestedMaterials?.length || 0;
            const materialListPreview = template.suggestedMaterials?.map((sm) => {
              const catItem = catalog.find((ci) => ci.sku === sm.sku);
              return catItem ? `${catItem.name} (${sm.quantity} יח')` : null;
            }).filter(Boolean).join(", ");

            return (
              <div
                key={template.id}
                onClick={() => onAddJobFromTemplate(template)}
                className="group relative bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-200 border border-slate-100 p-4 rounded-xl transition cursor-pointer flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-black px-2 py-0.5 rounded">
                      {template.category}
                    </span>
                    
                    {/* Actions tools overlaying */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleOpenEditForm(template, e)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition shadow-xs"
                        title="ערוך תבנית זו"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleRemoveTemplate(template.id, e)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition shadow-xs"
                        title="מחק תבנית זו"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h4 className="text-sm font-black text-slate-800 group-hover:text-indigo-950 transition leading-tight">
                      {template.title}
                    </h4>
                  </div>
                  
                  <div className="text-xs font-bold text-indigo-600/90 mb-2">
                    מחיר עבודה: ₪{template.defaultLaborCost}
                  </div>

                  {materialsCount > 0 && (
                    <div className="flex items-start gap-1 mt-1 text-slate-500 text-[10px] leading-relaxed bg-white/70 p-2 rounded border border-slate-100/50">
                      <Info className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                      <div className="line-clamp-2">
                        <span className="font-semibold text-slate-700">כולל חומרים: </span>
                        <span className="text-slate-500">{materialListPreview}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-2 border-t border-slate-100/50 flex items-center justify-end text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>הוסף לעבודה הנוכחית</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
