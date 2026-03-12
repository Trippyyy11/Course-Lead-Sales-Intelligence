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

function App() {
  const [files, setFiles] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Multi-Step Join State
  // The first join is special: File A + File B
  // Subsequent joins: Previous Result + New File
  const [joins, setJoins] = useState([
    { id: crypto.randomUUID(), fileA: '', keyA: '', fileB: '', keyB: '', type: 'inner' }
  ]);

  // Preview Data tracking the final result of the chain
  const [previewData, setPreviewData] = useState(null);
  const [finalResultId, setFinalResultId] = useState(null);
  const [activeColumns, setActiveColumns] = useState([]); // Columns available after current chain

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
      keyB: '', 
      keyA: '', // This will be the key from the PREVIOUS result
      type: 'inner' 
    }]);
  };

  const removeJoinStep = (id) => {
    if (joins.length === 1) return;
    setJoins(joins.filter(j => j.id !== id));
  };

  const updateJoin = (id, field, value) => {
    setJoins(joins.map(j => j.id === id ? { ...j, [field]: value } : j));
  };

  const executeChain = async () => {
    setExecuteLoading(true);
    setError(null);
    setPreviewData(null);
    setSuccess(null);

    try {
      let currentFileA = joins[0].fileA;
      let currentResultId = null;
      let lastCols = [];

      for (let i = 0; i < joins.length; i++) {
        const step = joins[i];
        
        // Validation
        if (i === 0 && (!step.fileA || !step.fileB || !step.keyA || !step.keyB)) {
          throw new Error(`Step 1: Please select both files and keys`);
        }
        if (i > 0 && (!step.fileB || !step.keyA || !step.keyB)) {
          throw new Error(`Step ${i + 1}: Please select file and keys`);
        }

        const leftId = i === 0 ? step.fileA : currentResultId;
        const resp = await axios.post(`${API_BASE}/join?file_a_id=${leftId}&file_b_id=${step.fileB}&key_a=${step.keyA}&key_b=${step.keyB}&join_type=${step.type}`);
        
        currentResultId = resp.data.result_id;
        lastCols = resp.data.columns;
      }

      setFinalResultId(currentResultId);
      setActiveColumns(lastCols);

      // Fetch preview
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

      <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-sm">
              Forge<span className="text-indigo-400">Join</span>
            </h1>
          </div>
          <p className="text-slate-400 font-medium">No-code data orchestration & intelligent merging.</p>
        </motion.div>

        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold">{files.length} Datasets Loaded</span>
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Sidebar: Pipeline Builder */}
        <div className="xl:col-span-4 space-y-6">
          {/* Upload Card */}
          <section className="glass-card p-6 border-white/10">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-5">
              <Upload className="w-5 h-5 text-indigo-400" /> Source Data
            </h2>
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
            {uploadLoading && <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 animate-[loading_2s_infinite]" style={{width: '60%'}}></div></div>}
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
                  <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                    {index === 0 ? (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">File A (Base)</label>
                        <select 
                          className="glass-input text-xs"
                          value={join.fileA}
                          onChange={(e) => updateJoin(join.id, 'fileA', e.target.value)}
                        >
                          <option value="">Select Primary File</option>
                          {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-2 px-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-300 italic">Result of Step {index}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                       <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Join Key (Left)</label>
                        <select 
                          className="glass-input text-[11px]"
                          value={join.keyA}
                          onChange={(e) => updateJoin(join.id, 'keyA', e.target.value)}
                          disabled={index === 0 ? !join.fileA : false}
                        >
                          <option value="">Select Key</option>
                          {/* Columns from fileA if index 0, otherwise we don't know yet because pipeline hasn't run. 
                              In a real app, we'd simulate the schema or run incrementally. 
                              For now, we'll allow manual entry or try to guess if we have activeColumns (from last run) 
                          */}
                          {(index === 0 ? getFileColumns(join.fileA) : activeColumns).map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Join Type</label>
                        <select 
                          className="glass-input text-[11px]"
                          value={join.type}
                          onChange={(e) => updateJoin(join.id, 'type', e.target.value)}
                        >
                          <option value="inner">Inner</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                          <option value="outer">Outer</option>
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3 mt-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Combine with File</label>
                      <select 
                        className="glass-input text-xs"
                        value={join.fileB}
                        onChange={(e) => updateJoin(join.id, 'fileB', e.target.value)}
                      >
                        <option value="">Select Target File</option>
                        {files.filter(f => f.id !== join.fileA).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Join Key (Right)</label>
                      <select 
                        className="glass-input text-[11px]"
                        value={join.keyB}
                        onChange={(e) => updateJoin(join.id, 'keyB', e.target.value)}
                        disabled={!join.fileB}
                      >
                        <option value="">Select Key</option>
                        {getFileColumns(join.fileB).map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button
              onClick={executeChain}
              disabled={executeLoading || files.length < 2}
              className="glass-button primary-gradient w-full mt-8 flex items-center justify-center gap-2 text-sm shadow-indigo-500/20"
            >
              {executeLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Orchestrating Pipeline...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Execute Join Sequence
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
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleDownload}
                  className="glass-button bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 text-xs py-2 flex items-center gap-2"
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
                <span>{error}</span>
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
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 border border-white/5 rounded-3xl bg-white/[0.02]">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 text-white/10">
                    <Database className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-300">Awaiting Pipeline Execution</h3>
                  <p className="max-w-[280px] text-center text-sm text-slate-500 mt-2 leading-relaxed">
                    Upload your datasets and configure the join logic to see magic happen.
                  </p>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="table-glass h-full border-white/5"
                >
                  <div className="overflow-auto max-h-[500px]">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
                          {previewData.columns.map(col => (
                            <th key={col} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {previewData.data.map((row, i) => (
                          <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                            {previewData.columns.map(col => (
                              <td key={`${i}-${col}`} className="px-6 py-4 text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors whitespace-nowrap">
                                {String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-white/5 border-t border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                    Top 50 Sample Rows
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
