import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Table, Download, Settings, FileText, 
  AlertCircle, CheckCircle2, Plus, Trash2, 
  ArrowRight, Layers, Sparkles, Database, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for tailwind classes */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const API_BASE = 'http://localhost:8000';

/** Custom Select Component for Premium UI */
function CustomSelect({ label, value, options, onChange, placeholder, disabled, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={cn("space-y-1.5 w-full relative", className)}>
      {label && <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "glass-input text-left flex items-center justify-between group",
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && "border-indigo-500/50 bg-white/10"
          )}
        >
          <span className={cn("truncate", !selectedOption && "text-slate-500")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Settings className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              {/* Click outside backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute z-50 w-full mt-2 dropdown-menu p-1.5 border-white/10 max-h-64 overflow-auto shadow-2xl left-0"
              >
                {options.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500 italic text-center">No options available</div>
                ) : (
                  options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl text-xs transition-all mb-1 last:mb-0",
                        value === opt.value 
                          ? "bg-indigo-600 text-white font-bold" 
                          : "text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-1"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function App() {
  const [files, setFiles] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Multi-Step Join State
  const [joins, setJoins] = useState([
    { 
      id: crypto.randomUUID(), 
      fileA: '', 
      keysA: [''], 
      fileB: '', 
      keysB: [''], 
      type: 'inner', 
      suggestions: [],
      transformations: { drop: [], rename: {}, cast: {} }
    }
  ]);

  const [metrics, setMetrics] = useState(null); // Health metrics for final result
  const [showTransforms, setShowTransforms] = useState({}); // Track expanded transforms by joinId

  const [previewData, setPreviewData] = useState(null);
  const [finalResultId, setFinalResultId] = useState(null);
  const [activeColumns, setActiveColumns] = useState([]);

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;

    setUploadLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    uploadedFiles.forEach(file => formData.append('files', file));

    try {
      const resp = await axios.post(`${API_BASE}/upload`, formData);
      setFiles(prev => [...prev, ...resp.data.files]);
      setSuccess('Datasets imported successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed');
    } finally {
      setUploadLoading(false);
    }
  };

  const addJoinStep = () => {
    setJoins([...joins, { 
      id: crypto.randomUUID(), 
      fileB: '', 
      keysB: [''], 
      keysA: [''], 
      type: 'inner',
      suggestions: [],
      transformations: { drop: [], rename: {}, cast: {} }
    }]);
  };

  const removeJoinStep = (id) => {
    if (joins.length === 1) return;
    setJoins(joins.filter(j => j.id !== id));
  };

  const updateJoin = async (id, field, value) => {
    setJoins(prevJoins => {
      const newJoins = prevJoins.map(j => j.id === id ? { ...j, [field]: value } : j);
      
      // Auto-fetch suggestions if files are selected
      const join = newJoins.find(j => j.id === id);
      if ((field === 'fileA' || field === 'fileB') && join.fileA && join.fileB) {
        fetchSuggestions(id, join.fileA, join.fileB);
      }
      return newJoins;
    });
  };

  const fetchSuggestions = async (joinId, fileA, fileB) => {
    try {
      const resp = await axios.post(`${API_BASE}/analyze-schema?file_a_id=${fileA}&file_b_id=${fileB}`);
      setJoins(prev => prev.map(j => j.id === joinId ? { ...j, suggestions: resp.data.suggestions } : j));
    } catch (err) {
      console.error("Suggestion fetch failed", err);
    }
  };

  const addKeyPair = (joinId) => {
    setJoins(prev => prev.map(j => j.id === joinId ? { ...j, keysA: [...j.keysA, ''], keysB: [...j.keysB, ''] } : j));
  };

  const removeKeyPair = (joinId, index) => {
    setJoins(prev => prev.map(j => j.id === joinId ? { 
      ...j, 
      keysA: j.keysA.filter((_, i) => i !== index),
      keysB: j.keysB.filter((_, i) => i !== index)
    } : j));
  };

  const updateKey = (joinId, side, index, value) => {
    setJoins(prev => prev.map(j => j.id === joinId ? {
      ...j,
      [side]: j[side].map((k, i) => i === index ? value : k)
    } : j));
  };

  const updateTransformation = (joinId, field, value) => {
    setJoins(prev => prev.map(j => j.id === joinId ? {
      ...j,
      transformations: { ...j.transformations, [field]: value }
    } : j));
  };

  const saveProject = () => {
    const project = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      joins: joins.map(({ suggestions, ...rest }) => rest), // Don't save transient suggestions
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline_${new Date().getTime()}.forge`;
    link.click();
    setSuccess("Project configuration exported successfully.");
  };

  const loadProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const project = JSON.parse(event.target.result);
        if (project.joins) {
          setJoins(project.joins.map(j => ({ ...j, suggestions: [] })));
          setSuccess("Project configuration loaded.");
        }
      } catch (err) {
        setError("Failed to load project file.");
      }
    };
    reader.readAsText(file);
  };

  const executeChain = async () => {
    setExecuteLoading(true);
    setError(null);
    setPreviewData(null);
    setSuccess(null);

    try {
      let currentResultId = null;
      let lastCols = [];

      for (let i = 0; i < joins.length; i++) {
        const step = joins[i];
        
        if (i === 0 && (!step.fileA || !step.fileB || step.keysA.some(k => !k) || step.keysB.some(k => !k))) {
          throw new Error(`Step 1: Please select both files and all keys`);
        }
        if (i > 0 && (!step.fileB || step.keysA.some(k => !k) || step.keysB.some(k => !k))) {
          throw new Error(`Step ${i + 1}: Please select file and all keys`);
        }

        const leftId = i === 0 ? step.fileA : currentResultId;
        
        // Construct query parameters for multiple keys
        const params = new URLSearchParams();
        params.append('file_a_id', leftId);
        params.append('file_b_id', step.fileB);
        step.keysA.forEach(k => params.append('keys_a', k));
        step.keysB.forEach(k => params.append('keys_b', k));
        params.append('join_type', step.type);

        const resp = await axios.post(`${API_BASE}/join?${params.toString()}`, step.transformations);
        
        currentResultId = resp.data.result_id;
        lastCols = resp.data.columns;
        if (i === joins.length - 1) {
          setMetrics(resp.data.metrics);
        }
      }

      setFinalResultId(currentResultId);
      setActiveColumns(lastCols);

      const previewResp = await axios.get(`${API_BASE}/preview/${currentResultId}`);
      setPreviewData(previewResp.data);
      setSuccess('Data pipeline executed successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Execution failed');
    } finally {
      setExecuteLoading(false);
    }
  };

  const handleDownload = () => {
    if (!finalResultId) return;
    window.open(`${API_BASE}/download/${finalResultId}`, '_blank');
  };

  const getFileColumns = (fileId) => {
    const file = files.find(f => f.id === fileId);
    return file ? file.columns : [];
  };

  return (
    <div className="min-h-screen text-slate-100 p-4 md:p-8">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-500/10 blur-[120px] rounded-full" />
      </div>

      <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-linear-to-r from-white to-white/60 bg-clip-text text-transparent">ForgeJoin Pro</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Pipeline Orchestrator v2.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
             <label className="cursor-pointer glass-button !py-2 !px-4 text-[10px] bg-white/5 hover:bg-white/10 flex items-center gap-2 border border-white/10">
                <Upload className="w-3.5 h-3.5" /> Open Project
                <input type="file" className="hidden" accept=".forge" onChange={loadProject} />
             </label>
             <button onClick={saveProject} className="glass-button !py-2 !px-4 text-[10px] bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 flex items-center gap-2">
                <Download className="w-3.5 h-3.5" /> Save Configuration
             </button>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold">{files.length} Datasets</span>
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Sidebar: Pipeline Builder */}
        <div className="xl:col-span-4 space-y-6 h-fit xl:sticky xl:top-8 overflow-y-auto xl:max-h-[calc(100vh-4rem)] pr-2 custom-scrollbar">
          {/* Upload Card */}
          <section className="glass-card p-6 border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-400" /> Source Data
              </h2>
            </div>
            <div className="relative group">
              <input
                type="file" multiple onChange={handleFileUpload} accept=".csv,.xls,.xlsx"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border border-dashed border-white/20 rounded-2xl p-6 text-center group-hover:border-indigo-500/50 group-hover:bg-white/5 transition-all">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-slate-300">Drop files here</p>
                <p className="text-xs text-slate-500 mt-1">Excel or CSV supported</p>
              </div>
            </div>
            
            <div className="mt-4 flex flex-wrap gap-2">
              <AnimatePresence>
                {files.map(f => (
                  <motion.div 
                    key={f.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] font-bold text-emerald-400 uppercase tracking-widest"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {f.name}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {uploadLoading && <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden"><motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-full w-1/2 bg-indigo-500"></motion.div></div>}
          </section>

          {/* Pipeline Card */}
          <section className="glass-card p-6 border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" /> Join Pipeline
              </h2>
              <button 
                onClick={addJoinStep}
                className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all group"
                title="Add Join Step"
              >
                <Plus className="w-4 h-4 text-slate-400 group-hover:text-indigo-400" />
              </button>
            </div>

            <div className="space-y-8 relative">
              {joins.map((join, index) => (
                <motion.div 
                  key={join.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 relative"
                >
                  {index > 0 && (
                    <div className="absolute -top-6 left-5 w-px h-4 bg-white/10" />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Step {index + 1}
                    </span>
                    {joins.length > 1 && (
                      <button onClick={() => removeJoinStep(join.id)} className="text-slate-500 hover:text-rose-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Join Block */}
                  <div className="space-y-6 p-5 bg-white/5 rounded-2xl border border-white/5 relative">
                    {index === 0 ? (
                      <CustomSelect 
                        label="File A (Base)"
                        value={join.fileA}
                        options={files.map(f => ({ value: f.id, label: f.name }))}
                        onChange={(val) => updateJoin(join.id, 'fileA', val)}
                        placeholder="Select Primary Dataset"
                      />
                    ) : (
                      <div className="flex items-center gap-2 py-3 px-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-inner">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-300 italic tracking-wide">Output of Pipeline Step {index}</span>
                      </div>
                    )}

                    {/* Suggestions Box */}
                    {join.suggestions && join.suggestions.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2"
                      >
                         <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                           <Sparkles className="w-3 h-3" /> Intelligent Map Suggesions
                         </div>
                         <div className="flex flex-wrap gap-2">
                            {join.suggestions.map((s, idx) => (
                              <button 
                                key={idx}
                                onClick={() => {
                                  // Apply suggestion to the first key pair
                                  updateKey(join.id, 'keysA', 0, s.key_a);
                                  updateKey(join.id, 'keysB', 0, s.key_b);
                                }}
                                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-[9px] font-bold text-amber-200 border border-amber-500/30 transition-all"
                              >
                                {s.key_a} ✨ {s.key_b}
                              </button>
                            ))}
                         </div>
                      </motion.div>
                    )}

                    <div className="space-y-4">
                      {join.keysA.map((_, kIdx) => (
                        <div key={kIdx} className="relative p-4 bg-white/5 border border-white/5 rounded-xl space-y-4">
                          {join.keysA.length > 1 && (
                            <button 
                              onClick={() => removeKeyPair(join.id, kIdx)}
                              className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <CustomSelect 
                              label={`Key ${kIdx + 1} (Left)`}
                              value={join.keysA[kIdx]}
                              options={(index === 0 ? getFileColumns(join.fileA) : activeColumns).map(col => ({ value: col, label: col }))}
                              onChange={(val) => updateKey(join.id, 'keysA', kIdx, val)}
                              placeholder="Select Key"
                              disabled={index === 0 && !join.fileA}
                            />
                            <CustomSelect 
                              label={`Key ${kIdx + 1} (Right)`}
                              value={join.keysB[kIdx]}
                              options={getFileColumns(join.fileB).map(col => ({ value: col, label: col }))}
                              onChange={(val) => updateKey(join.id, 'keysB', kIdx, val)}
                              placeholder="Select Key"
                              disabled={!join.fileB}
                            />
                          </div>
                        </div>
                      ))}
                      
                      <button 
                        onClick={() => addKeyPair(join.id)}
                        className="w-full py-2 border border-dashed border-white/20 rounded-xl text-[10px] font-bold text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 transition-all uppercase tracking-widest"
                      >
                        + Add Join Key Pair
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <CustomSelect 
                        label="Join Strategy"
                        value={join.type}
                        options={[
                          { value: 'inner', label: 'Inner Join (Intersect)' },
                          { value: 'left', label: 'Left Join (Keep A)' },
                          { value: 'right', label: 'Right Join (Keep B)' },
                          { value: 'outer', label: 'Outer Join (Find All)' },
                          { value: 'append', label: 'Append (Merge Same Columns)' }
                        ]}
                        onChange={(val) => updateJoin(join.id, 'type', val)}
                        placeholder="Join Strategy"
                      />
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <CustomSelect 
                        label="Target Dataset"
                        value={join.fileB}
                        options={files.filter(f => f.id !== (index === 0 ? join.fileA : '')).map(f => ({ value: f.id, label: f.name }))}
                        onChange={(val) => updateJoin(join.id, 'fileB', val)}
                        placeholder="Select Target Dataset"
                      />
                    </div>

                    {/* Transformations Toggle */}
                    <div className="space-y-3 pt-2">
                       <button 
                        onClick={() => setShowTransforms(prev => ({ ...prev, [join.id]: !prev[join.id] }))}
                        className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
                       >
                         {showTransforms[join.id] ? <X className="w-3 h-3" /> : <Settings className="w-3 h-3" />}
                         {showTransforms[join.id] ? 'Hide' : 'Advanced'} Transformations
                       </button>

                       <AnimatePresence>
                         {showTransforms[join.id] && (                            <motion.div 
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="bg-slate-900/50 rounded-xl p-4 border border-white/5 space-y-4 overflow-y-auto max-h-[400px]"
                            >
                               <div className="space-y-4">
                                 {/* Helper to get ALL columns involved in this step */}
                                 {(() => {
                                   const colsA = getFileColumns(index === 0 ? join.fileA : 'result');
                                   const colsB = getFileColumns(join.fileB);
                                   const allCols = [...new Set([...colsA, ...colsB])].sort();
                                   
                                   return (
                                     <>
                                       <div className="space-y-2">
                                         <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1 underline decoration-rose-500/50">Columns to Drop</label>
                                         <div className="flex flex-wrap gap-2">
                                           {allCols.map(col => (
                                             <button 
                                               key={col}
                                               onClick={() => {
                                                 const drops = join.transformations.drop.includes(col) 
                                                   ? join.transformations.drop.filter(d => d !== col)
                                                   : [...join.transformations.drop, col];
                                                 updateTransformation(join.id, 'drop', drops);
                                               }}
                                               className={cn(
                                                 "px-2 py-1 rounded-lg text-[9px] font-bold border transition-all",
                                                 join.transformations.drop.includes(col)
                                                   ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                                                   : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                               )}
                                             >
                                               -{col}
                                             </button>
                                           ))}
                                         </div>
                                       </div>
                                       
                                       <div className="space-y-2">
                                         <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1 underline decoration-amber-500/50">Column Renaming</label>
                                         <div className="grid grid-cols-1 gap-2">
                                           <div className="flex items-center gap-2">
                                             <select 
                                               className="glass-input !py-1.5 !text-[10px] flex-1 bg-slate-900 border border-white/10 rounded-lg text-slate-300"
                                               onChange={(e) => {
                                                 if (e.target.value) {
                                                   updateTransformation(join.id, 'rename', { ...join.transformations.rename, [e.target.value]: e.target.value + "_renamed" });
                                                   e.target.value = "";
                                                 }
                                               }}
                                               value=""
                                             >
                                               <option value="" disabled>Select Column to Rename...</option>
                                               {allCols.filter(c => !join.transformations.rename[c]).map(c => (
                                                 <option key={c} value={c}>{c}</option>
                                               ))}
                                             </select>
                                           </div>
                                           {Object.entries(join.transformations.rename).map(([old, curr]) => (
                                              <div key={old} className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                                                 <span className="text-[10px] font-mono text-slate-400 max-w-[100px] truncate">{old}</span>
                                                 <ArrowRight className="w-3 h-3 text-indigo-500 shrink-0" />
                                                 <input 
                                                   value={curr}
                                                   className="bg-transparent text-[10px] text-white outline-none text-right placeholder-indigo-500/50 flex-1 ml-2"
                                                   placeholder="Rename to..."
                                                   onChange={(e) => updateTransformation(join.id, 'rename', { ...join.transformations.rename, [old]: e.target.value })}
                                                 />
                                                 <button onClick={() => {
                                                   const newRename = { ...join.transformations.rename };
                                                   delete newRename[old];
                                                   updateTransformation(join.id, 'rename', newRename);
                                                 }} className="ml-2 text-rose-500/50 hover:text-rose-500">
                                                   <X className="w-3 h-3" />
                                                 </button>
                                              </div>
                                           ))}
                                         </div>
                                       </div>
                                       
                                       <div className="space-y-2">
                                         <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1 underline decoration-violet-500/50">Type Casting</label>
                                         <div className="grid grid-cols-1 gap-2">
                                            {Object.entries(join.transformations.cast).map(([col, type]) => (
                                              <div key={col} className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                                                 <span className="text-[10px] font-mono text-slate-400 max-w-[100px] truncate">{col}</span>
                                                 <div className="flex items-center gap-2">
                                                   <select 
                                                     value={type}
                                                     onChange={(e) => updateTransformation(join.id, 'cast', { ...join.transformations.cast, [col]: e.target.value })}
                                                     className="bg-transparent text-[10px] text-indigo-400 outline-none border-none"
                                                   >
                                                     <option value="str">String</option>
                                                     <option value="int64">Integer</option>
                                                     <option value="float64">Float</option>
                                                     <option value="datetime64[ns]">DateTime</option>
                                                   </select>
                                                   <button onClick={() => {
                                                     const newCast = { ...join.transformations.cast };
                                                     delete newCast[col];
                                                     updateTransformation(join.id, 'cast', newCast);
                                                   }} className="text-rose-500 hover:text-rose-400">
                                                     <X className="w-3 h-3" />
                                                   </button>
                                                 </div>
                                              </div>
                                            ))}
                                            <select 
                                               className="glass-input !py-1.5 !text-[10px] w-full bg-slate-900 border border-white/10 rounded-lg text-slate-300 mt-2"
                                               onChange={(e) => {
                                                 if (e.target.value) {
                                                   updateTransformation(join.id, 'cast', { ...join.transformations.cast, [e.target.value]: 'str' });
                                                   e.target.value = "";
                                                 }
                                               }}
                                               value=""
                                             >
                                               <option value="" disabled>Select Column to Cast...</option>
                                               {allCols.filter(c => !join.transformations.cast[c]).map(c => (
                                                 <option key={c} value={c}>{c}</option>
                                               ))}
                                             </select>
                                         </div>
                                       </div>
                                     </>
                                   );
                                 })()}
                               </div>
                            </motion.div>
                         )}
                       </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Metrics Dashboard */}
            {metrics && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-3 mt-8"
              >
                {[
                  { label: "Overlap Rate", value: `${metrics.match_rate_a}%`, sub: "Base Match", color: "text-indigo-400" },
                  { label: "Coverage", value: `${metrics.match_rate_b}%`, sub: "Target Match", color: "text-violet-400" },
                  { label: "Nulls", value: metrics.null_count, sub: "Data Gaps", color: "text-amber-400" },
                  { label: "Dupes", value: metrics.duplicate_count, sub: "Redundant", color: "text-rose-400" }
                ].map((m, i) => (
                  <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-4 group hover:border-white/10 transition-all flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block mb-0.5">{m.label}</span>
                      <div className={`text-lg font-bold ${m.color}`}>
                        {m.value}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 italic font-medium">{m.sub}</p>
                  </div>
                ))}
              </motion.div>
            )}

            <button
              onClick={executeChain}
              disabled={executeLoading || files.length < 2}
              className="glass-button primary-gradient w-full mt-8 flex items-center justify-center gap-2 text-sm shadow-xl"
            >
              {executeLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Building Pipeline...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Harmonize & Execute
                </>
              )}
            </button>
          </section>
        </div>

        {/* Main Area: Preview */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <section className="glass-card flex-1 flex flex-col p-8 border-white/10 min-h-[600px]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div className="space-y-1">
                <h2 className="text-2xl font-black flex items-center gap-3">
                  <Table className="w-6 h-6 text-indigo-400" /> Live Preview
                </h2>
                <p className="text-slate-400 text-sm font-medium">Verified output of your data orchestration chain.</p>
              </div>
              {previewData && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownload}
                  className="glass-button bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 text-xs py-2 flex items-center gap-2 px-5"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </motion.button>
              )}
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{typeof error === 'object' ? JSON.stringify(error) : error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm font-medium"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{success}</span>
              </motion.div>
            )}

            <div className="flex-1 relative">
              {!previewData ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 border border-slate-700/80 rounded-3xl bg-slate-900/70 shadow-[0_0_40px_rgba(15,23,42,0.9)]">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 text-white/10">
                    <Database className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-300">Awaiting Pipeline Execution</h3>
                  <p className="max-w-[280px] text-center text-sm text-slate-500 mt-2 leading-relaxed font-medium">
                    Upload your datasets and configure the join logic to see magic happen.
                  </p>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full rounded-3xl border border-slate-700/80 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.18),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(8,47,73,0.9),_rgba(15,23,42,1))] shadow-[0_0_40px_rgba(15,23,42,0.9)] overflow-hidden"
                >
                  <div className="overflow-auto max-h-[500px]">
                    <table className="w-full border-collapse text-left text-slate-200">
                      <thead className="bg-slate-900/80 backdrop-blur-md">
                        <tr className="border-b border-slate-700/80">
                          {previewData.columns.map(col => (
                            <th
                              key={col}
                              className="px-6 py-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {previewData.data.map((row, i) => (
                          <tr
                            key={i}
                            className="group transition-colors even:bg-slate-900/40 hover:bg-slate-800/60"
                          >
                            {previewData.columns.map(col => (
                              <td
                                key={`${i}-${col}`}
                                className="px-6 py-3 text-xs font-medium text-slate-300 group-hover:text-slate-50 transition-colors whitespace-nowrap"
                              >
                                {String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-slate-900/80 border-t border-slate-700/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    Top 50 Sample Rows • Dark Preview
                  </div>
                </motion.div>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 flex justify-center opacity-30">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">
          Intelligence in Every Merge • ForgeJoin Pro
        </p>
      </footer>
    </div>
  );
}

export default App;
