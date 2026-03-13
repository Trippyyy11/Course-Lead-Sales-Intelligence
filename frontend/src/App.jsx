import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const containerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, position: 'bottom' });
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const menuHeight = Math.min(options.length * 48 + 20, 256);
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Flip if not enough space below AND there is more space above
        const shouldFlip = spaceBelow < menuHeight + 20 && spaceAbove > spaceBelow;

        setCoords({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          position: shouldFlip ? 'top' : 'bottom'
        });
      }
    };

    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', () => setIsOpen(false), { once: true });
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, options.length]);

  const menuContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click outside backdrop */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: coords.position === 'bottom' ? -10 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: coords.position === 'bottom' ? -10 : 10 }}
            className="fixed z-[9999] dropdown-menu p-1.5 border-white/10 max-h-64 overflow-auto shadow-2xl"
            style={{
              top: coords.position === 'bottom' ? coords.bottom + 4 : 'auto',
              bottom: coords.position === 'top' ? (window.innerHeight - coords.top) + 4 : 'auto',
              left: coords.left,
              width: coords.width,
              transformOrigin: coords.position === 'bottom' ? 'top' : 'bottom'
            }}
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
                      ? "bg-[#0F0842] text-white font-bold" 
                      : "text-slate-600 hover:bg-[#0F0842]/5 hover:text-[#0F0842] hover:translate-x-1"
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
  );

  return (
    <div className={cn("space-y-1.5 w-full relative", className)} ref={containerRef}>
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

        {isOpen && createPortal(menuContent, document.body)}
      </div>
    </div>
  );
}

const STAGES = [
  { id: 0, name: 'Sources', icon: Database },
  { id: 1, name: 'Pipeline', icon: Settings },
  { id: 2, name: 'Review', icon: Table }
];

function Stepper({ currentStage, setCurrentStage, files }) {
  return (
    <div className="flex items-center gap-4 bg-white/50 border border-[#0F0842]/10 rounded-full px-6 py-3 backdrop-blur-xl shadow-sm">
      {STAGES.map((s, i) => (
        <React.Fragment key={s.id}>
           <button
            type="button"
            onClick={() => files.length >= 2 || s.id === 0 ? setCurrentStage(s.id) : null}
            disabled={files.length < 2 && s.id > 0}
            className={cn(
              "stepper-item group",
              currentStage === s.id && "active",
              currentStage > s.id && "completed",
              files.length < 2 && s.id > 0 && "disabled"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              currentStage === s.id ? "bg-[#0F0842] text-white shadow-lg shadow-[#0F0842]/20" : "bg-[#0F0842]/5 text-slate-400"
            )}>
              <s.icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest hidden md:block">{s.name}</span>
          </button>
          {i < STAGES.length - 1 && <div className="w-8 h-px bg-[#0F0842]/10" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function ActionBar({ currentStage, setCurrentStage, files, executeChain, executeLoading, handleDownload, finalResultId }) {
  return (
    <div className="action-bar border-[#0F0842]/10">
       <button 
        type="button"
        disabled={currentStage === 0}
        onClick={() => setCurrentStage(prev => prev - 1)}
        className="glass-button bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-2 border border-[#0F0842]/10 shadow-sm"
       >
         <ArrowRight className="w-4 h-4 rotate-180" /> Previous
       </button>
       
       <div className="h-6 w-px bg-[#0F0842]/10" />

       {currentStage < 2 ? (
         <button 
          type="button"
          disabled={files.length < 2}
          onClick={() => {
            if (currentStage === 1) executeChain();
            else setCurrentStage(prev => prev + 1);
          }}
          className="glass-button primary-gradient flex items-center gap-2"
         >
           {currentStage === 1 ? (executeLoading ? 'Executing...' : 'Run Pipeline') : 'Next Stage'}
           <ArrowRight className="w-4 h-4" />
         </button>
       ) : (
         <button 
          type="button"
          onClick={handleDownload}
          disabled={!finalResultId}
          className="glass-button bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-2"
         >
           <Download className="w-4 h-4" /> Export Result
         </button>
       )}
    </div>
  );
}

function SourcesView({ files, handleFileUpload, uploadLoading }) {
  return (
    <div className="stage-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <section className="glass-card p-8 border-[#0F0842]/10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black flex items-center gap-3 text-[#0F0842]">
              <Upload className="w-6 h-6 text-[#0F0842]" /> Import Data
            </h2>
          </div>
          <div className="relative group">
            <input
              type="file" multiple onChange={handleFileUpload} accept=".csv,.xls,.xlsx"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="border-2 border-dashed border-[#0F0842]/10 rounded-3xl p-12 text-center group-hover:border-[#0F0842]/30 group-hover:bg-[#E9D5FF]/20 transition-all">
              <div className="w-20 h-20 bg-[#0F0842]/5 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <FileText className="w-10 h-10 text-[#0F0842]" />
              </div>
              <h3 className="text-lg font-bold text-[#0F0842] mb-2">Select or Drop Files</h3>
              <p className="text-sm text-slate-500 max-w-[200px] mx-auto">Excel or CSV files supported for harmonization.</p>
            </div>
          </div>
          {uploadLoading && (
            <div className="mt-8 space-y-2">
              <div className="flex justify-between text-[10px] font-black text-[#0F0842] uppercase tracking-widest">
                <span>Uploading Datasets...</span>
                <span>Wait a moment</span>
              </div>
              <div className="h-1.5 w-full bg-[#0F0842]/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ x: "-100%" }} 
                  animate={{ x: "100%" }} 
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} 
                  className="h-full w-1/2 bg-[#0F0842] shadow-[0_0_10px_rgba(15,8,66,0.3)]"
                />
              </div>
            </div>
          )}
        </section>

        <section className="glass-card p-8 border-[#0F0842]/10 overflow-hidden">
           <h2 className="text-2xl font-black flex items-center gap-3 mb-8">
              <Database className="w-6 h-6 text-emerald-600" /> Active Inventory
            </h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
               {files.length === 0 ? (
                 <div className="py-12 text-center opacity-30 flex flex-col items-center gap-4 text-[#0F0842]">
                    <Layers className="w-12 h-12" />
                    <p className="text-sm font-bold uppercase tracking-widest">No Datasets Loaded</p>
                 </div>
               ) : (
                 files.map(f => (
                  <motion.div 
                    key={f.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-4 bg-white border border-[#0F0842]/5 rounded-2xl group hover:border-[#0F0842]/20 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
                         <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold tracking-tight text-[#0F0842]">{f.name}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{f.columns.length} Columns</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </motion.div>
                ))
               )}
            </div>
        </section>
      </div>
    </div>
  );
}

function PipelineBuilder({ 
  joins, files, activeColumns, addJoinStep, removeJoinStep, 
  updateJoin, addKeyPair, removeKeyPair, updateKey, 
  updateTransformation, showTransforms, setShowTransforms, getFileColumns, getStepLeftColumns 
}) {
  return (
     <div className="stage-container animate-in fade-in slide-in-from-bottom-4 duration-500 text-[#0F0842]">
        <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-24">
           <div className="flex items-center justify-between">
             <h2 className="text-2xl font-black flex items-center gap-3">
               <Settings className="w-6 h-6 text-[#0F0842]" /> Pipeline Configuration
             </h2>
             <button 
               type="button"
               onClick={addJoinStep}
               className="glass-button bg-[#0F0842] text-white flex items-center gap-2 text-xs py-2 shadow-lg shadow-[#0F0842]/20"
             >
               <Plus className="w-4 h-4" /> Add Join Step
             </button>
           </div>

          <div className="space-y-12">
             {joins.map((join, index) => (
                <motion.div 
                  key={join.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative"
                >
                  <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[#0F0842]/5 rounded-full" />
                  
                  <div className="glass-card p-8 border-[#0F0842]/10 relative overflow-visible shadow-lg shadow-[#0F0842]/5">
                     <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-[#0F0842] text-white rounded-2xl flex items-center justify-center font-black shadow-lg shadow-[#0F0842]/20">
                              {index + 1}
                           </div>
                           <h3 className="text-lg font-bold text-[#0F0842]">Step {index + 1}: {index === 0 ? 'Primary Merge' : 'Chained Merge'}</h3>
                        </div>
                        {joins.length > 1 && (
                          <button type="button" onClick={() => removeJoinStep(join.id)} className="text-slate-500 hover:text-rose-400 transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                        <div className="space-y-6">
                           {index === 0 ? (
                            <CustomSelect 
                              label="Base Dataset (A)"
                              value={join.fileA}
                              options={files.map(f => ({ value: f.id, label: f.name }))}
                              onChange={(val) => updateJoin(join.id, 'fileA', val)}
                              placeholder="Choose starting point"
                            />
                           ) : (
                            <div className="p-4 bg-[#E9D5FF] rounded-2xl border border-[#0F0842]/5 shadow-sm">
                                <p className="text-[10px] font-black text-[#0F0842] uppercase tracking-widest mb-1">Source Dataset</p>
                                <span className="text-xs font-bold italic text-[#0F0842]/70">Previous Step Output</span>
                             </div>
                           )}

                           <CustomSelect 
                            label="Target Dataset (B)"
                            value={join.fileB}
                            options={files.filter(f => f.id !== (index === 0 ? join.fileA : '')).map(f => ({ value: f.id, label: f.name }))}
                            onChange={(val) => updateJoin(join.id, 'fileB', val)}
                            placeholder="Choose dataset to join"
                          />
                        </div>

                        <div className="space-y-6">
                           <CustomSelect 
                            label="Merge Strategy"
                            value={join.type}
                            options={[
                              { value: 'inner', label: 'Inner Join (Intersect)' },
                              { value: 'left', label: 'Left Join (Keep A)' },
                              { value: 'right', label: 'Right Join (Keep B)' },
                              { value: 'outer', label: 'Outer Join (Find All)' },
                              { value: 'append', label: 'Append (Merge Same Columns)' }
                            ]}
                            onChange={(val) => updateJoin(join.id, 'type', val)}
                            placeholder="Select Logic"
                          />
                        </div>
                     </div>

                     {/* Mapping Keys */}
                     <div className="mt-8 pt-8 border-t border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                           <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Key Mapping</h4>
                           <button type="button" onClick={() => addKeyPair(join.id)} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">+ Add Pair</button>
                        </div>


                        <div className="space-y-4">
                           {join.keysA.map((_, kIdx) => (
                             <div key={kIdx} className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto] gap-4 items-center">
                                <CustomSelect 
                                  value={join.keysA[kIdx]}
                                  options={getStepLeftColumns(index, join).map(col => ({ value: col, label: col }))}
                                  onChange={(val) => updateKey(join.id, 'keysA', kIdx, val)}
                                  placeholder="Left Key"
                                />
                                <ArrowRight className="w-4 h-4 text-slate-600 hidden md:block" />
                                <CustomSelect 
                                  value={join.keysB[kIdx]}
                                  options={getFileColumns(join.fileB).map(col => ({ value: col, label: col }))}
                                  onChange={(val) => updateKey(join.id, 'keysB', kIdx, val)}
                                  placeholder="Right Key"
                                />
                                {join.keysA.length > 1 && (
                                  <button type="button" onClick={() => removeKeyPair(join.id, kIdx)} className="text-rose-500/50 hover:text-rose-500">
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                             </div>
                           ))}
                        </div>
                     </div>

                     {/* Transformations Toggle */}
                     <div className="mt-8 pt-6 border-t border-white/5">
                        <button 
                          type="button"
                          onClick={() => setShowTransforms(prev => ({ ...prev, [join.id]: !prev[join.id] }))}
                          className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-indigo-400 transition-colors"
                        >
                          {showTransforms[join.id] ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                          {showTransforms[join.id] ? 'Minimize' : 'Refine'} Data Transformations
                        </button>
                        <AnimatePresence>
                          {showTransforms[join.id] && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-6 space-y-8 overflow-hidden"
                            >
                               <div className="bg-white/5 border border-white/5 rounded-3xl p-8 space-y-8">
                                  {/* Drop Columns */}
                                  <div>
                                    <h5 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4">Exclude Attributes</h5>
                                    <div className="flex flex-wrap gap-2">
                                      {(() => {
                                        const colsA = getStepLeftColumns(index, join);
                                        const colsB = getFileColumns(join.fileB);
                                        return [...new Set([...colsA, ...colsB])].sort().map(col => (
                                          <button 
                                            key={col}
                                            type="button"
                                            onClick={() => {
                                              const drops = join.transformations.drop.includes(col) 
                                                ? join.transformations.drop.filter(d => d !== col)
                                                : [...join.transformations.drop, col];
                                              updateTransformation(join.id, 'drop', drops);
                                            }}
                                            className={cn(
                                              "px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all",
                                              join.transformations.drop.includes(col)
                                                ? "bg-rose-500/20 border-rose-500/50 text-rose-400"
                                                : "bg-white/5 border-white/5 text-slate-500 hover:border-white/20"
                                            )}
                                          >
                                            {col}
                                          </button>
                                        ));
                                      })()}
                                    </div>
                                  </div>

                                  {/* Rename/Cast Simplified */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                     <div className="space-y-4">
                                        <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">Aliasing (Rename)</h5>
                                        <CustomSelect 
                                          placeholder="Column to rename..."
                                          options={[...new Set([...getStepLeftColumns(index, join), ...getFileColumns(join.fileB)])].filter(c => !join.transformations.rename[c]).map(c => ({ value: c, label: c }))}
                                          onChange={(val) => updateTransformation(join.id, 'rename', { ...join.transformations.rename, [val]: val })}
                                          value=""
                                        />
                                        <div className="space-y-2">
                                           {Object.entries(join.transformations.rename).map(([old, curr]) => (
                                              <div key={old} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl">
                                                <span className="text-[10px] font-mono text-slate-500 truncate w-24">#{old}</span>
                                                <input 
                                                  value={curr}
                                                  className="bg-transparent text-xs font-bold text-white outline-none flex-1 border-b border-white/10 focus:border-indigo-500 transition-colors"
                                                  onChange={(e) => updateTransformation(join.id, 'rename', { ...join.transformations.rename, [old]: e.target.value })}
                                                />
                                                <button type="button" onClick={() => {
                                                  const d = { ...join.transformations.rename }; delete d[old]; updateTransformation(join.id, 'rename', d);
                                                }} className="text-slate-600 hover:text-rose-500"><X className="w-4 h-4" /></button>
                                              </div>
                                           ))}
                                        </div>
                                     </div>

                                     <div className="space-y-4">
                                        <h5 className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-4">Schema Casting (Type)</h5>
                                        <CustomSelect 
                                          placeholder="Column to cast..."
                                          options={[...new Set([...getStepLeftColumns(index, join), ...getFileColumns(join.fileB)])].filter(c => !join.transformations.cast[c]).map(c => ({ value: c, label: c }))}
                                          onChange={(val) => updateTransformation(join.id, 'cast', { ...join.transformations.cast, [val]: 'str' })}
                                          value=""
                                        />
                                        <div className="space-y-2">
                                           {Object.entries(join.transformations.cast).map(([col, type]) => (
                                              <div key={col} className="flex items-center justify-between p-3 bg-white border border-[#0F0842]/5 rounded-2xl shadow-sm">
                                                <span className="text-[10px] font-mono text-slate-500 truncate w-24">#{col}</span>
                                                <select 
                                                  value={type}
                                                  onChange={(e) => updateTransformation(join.id, 'cast', { ...join.transformations.cast, [col]: e.target.value })}
                                                  className="bg-white text-[10px] font-bold text-[#0F0842] outline-none border border-[#0F0842]/10 rounded-lg px-2 py-1"
                                                >
                                                  <option value="str">String</option>
                                                  <option value="int64">Integer</option>
                                                  <option value="float64">Float</option>
                                                  <option value="datetime64[ns]">Date</option>
                                                </select>
                                                <button type="button" onClick={() => {
                                                  const d = { ...join.transformations.cast }; delete d[col]; updateTransformation(join.id, 'cast', d);
                                                }} className="text-slate-400 hover:text-rose-500 ml-2"><X className="w-4 h-4" /></button>
                                              </div>
                                           ))}
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                     </div>
                  </div>
                </motion.div>
             ))}
          </div>
       </div>
    </div>
  );
}

function ReviewView({ previewData, metrics, saveProject }) {
  return (
    <div className="stage-container animate-in fade-in slide-in-from-bottom-4 duration-500 text-[#0F0842]">
       <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3 space-y-8 pb-32">
             <section className="glass-card overflow-hidden border-[#0F0842]/10">
                <div className="p-8 border-b border-[#0F0842]/5 flex items-center justify-between bg-white">
                   <div>
                      <h2 className="text-2xl font-black flex items-center gap-3">
                        <Table className="w-6 h-6 text-[#0F0842]" /> Result Preview
                      </h2>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">First 50 synthesized records</p>
                   </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                   {!previewData ? (
                      <div className="py-32 text-center opacity-30 flex flex-col items-center gap-6">
                         <Sparkles className="w-16 h-16 animate-pulse" />
                         <p className="text-sm font-bold uppercase tracking-[0.3em]">No Data to Display</p>
                      </div>
                   ) : (
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50 shadow-sm z-10 sticky top-0 border-b border-[#0F0842]/10">
                            {previewData.columns.map(col => (
                              <th key={col} className="px-6 py-4 text-[10px] font-black text-[#0F0842] uppercase tracking-widest whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0F0842]/5 bg-white">
                          {previewData.data.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors group">
                               {previewData.columns.map(col => (
                                 <td key={`${i}-${col}`} className="px-6 py-3 text-xs font-medium text-slate-600 group-hover:text-[#0F0842] transition-colors whitespace-nowrap">{String(row[col])}</td>
                               ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   )}
                </div>
             </section>
          </div>

          <aside className="xl:col-span-1 space-y-6">
             <div className="glass-card p-8 border-[#0F0842]/10 shadow-lg">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#0F0842]/50 mb-6 border-b border-[#0F0842]/5 pb-4">Quality Metrics</h3>
                {metrics ? (
                  <div className="space-y-4">
                     {[
                        { label: "Missing Values", value: metrics.null_count, color: "bg-amber-500/10 text-amber-600", icon: AlertCircle },
                        { label: "Duplicates", value: metrics.duplicate_count, color: "bg-rose-500/10 text-rose-600", icon: Trash2 },
                     ].map((m, i) => (
                        <div key={i} className={`p-4 rounded-2xl border border-[#0F0842]/5 flex items-center justify-between`}>
                           <div>
                              <p className="text-[10px] font-black uppercase text-slate-500 tracking-tighter mb-1">{m.label}</p>
                              <span className={`text-xl font-black ${m.color.split(' ')[1]}`}>{m.value}</span>
                           </div>
                           <m.icon className={`w-5 h-5 ${m.color.split(' ')[1]}`} />
                        </div>
                     ))}
                  </div>
                ) : (
                  <div className="text-center py-8 opacity-20 text-xs font-bold italic uppercase">Metrics unavailable</div>
                )}
             </div>

             <button type="button" onClick={saveProject} className="w-full py-4 bg-white border border-[#0F0842]/10 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest text-[#0F0842]/60 hover:bg-slate-50 transition-all shadow-sm">
                <Download className="w-4 h-4" /> Export Config
             </button>
          </aside>
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
  const [currentStage, setCurrentStage] = useState(0); // 0: Sources, 1: Pipeline, 2: Review

  // Multi-Step Join State
  const [joins, setJoins] = useState([
    { 
      id: crypto.randomUUID(), 
      fileA: '', 
      keysA: [''], 
      fileB: '', 
      keysB: [''], 
      type: 'inner', 
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
      transformations: { drop: [], rename: {}, cast: {} }
    }]);
  };

  const removeJoinStep = (id) => {
    if (joins.length === 1) return;
    setJoins(joins.filter(j => j.id !== id));
  };

  const updateJoin = async (id, field, value) => {
    setJoins(prevJoins => prevJoins.map(j => j.id === id ? { ...j, [field]: value } : j));
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
      joins: joins,
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
          setJoins(project.joins);
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
      setCurrentStage(2); // Move to Review stage
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Execution failed');
    } finally {
      setExecuteLoading(false);
    }
  };

  /**
   * Heuristic: Get columns available for the "Left" side of a step.
   * If it's step 0, it's just File A.
   * If it's step > 0, it's the result of all previous steps.
   * If execution hasn't happened yet, we guess columns by unioning all previous files.
   */
  const getStepLeftColumns = (stepIndex, currentJoin) => {
    if (stepIndex === 0) return getFileColumns(currentJoin.fileA);
    
    // If we have real results from a previous execution, use them? 
    // Actually, execution usually gives the *final* columns. 
    // Let's stick to a robust heuristic: Union of all files involved in preceding steps.
    const involvedFiles = new Set();
    for (let i = 0; i < stepIndex; i++) {
        const step = joins[i];
        if (i === 0 && step.fileA) involvedFiles.add(step.fileA);
        if (step.fileB) involvedFiles.add(step.fileB);
    }

    const allCols = [];
    involvedFiles.forEach(fId => {
        allCols.push(...getFileColumns(fId));
    });

    return [...new Set(allCols)].sort();
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
    <div className="min-h-screen text-[#0F0842] p-4 md:p-8 pb-32">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#E9D5FF]/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#0F0842]/5 blur-[120px] rounded-full" />
      </div>

      <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-[#0F0842] rounded-3xl shadow-2xl shadow-[#0F0842]/20 rotate-3 transition-transform hover:rotate-0 cursor-default">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-[#0F0842]">ForgeJoin</h1>
            <p className="text-[#0F0842]/40 text-[10px] font-black uppercase tracking-[0.4em]">Engine v3.0 // Unified Pipeline</p>
          </div>
        </div>

        <Stepper currentStage={currentStage} setCurrentStage={setCurrentStage} files={files} />
        
        <div className="flex items-center gap-3">
          <label className="cursor-pointer glass-button !py-3 !px-6 text-[10px] bg-white hover:bg-slate-50 text-[#0F0842] flex items-center gap-2 border border-[#0F0842]/10 uppercase tracking-widest shadow-xl shadow-[#0F0842]/5">
            <Upload className="w-4 h-4" /> Open Project
            <input type="file" className="hidden" accept=".forge" onChange={loadProject} />
          </label>
        </div>
      </header>

      <main className="max-w-7xl mx-auto min-h-[60vh]">
         {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-3xl flex items-center gap-4 text-rose-600 text-sm font-bold shadow-2xl backdrop-blur-xl">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>{typeof error === 'object' ? JSON.stringify(error) : error}</span>
              <button onClick={() => setError(null)} className="ml-auto opacity-50 text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
            </motion.div>
         )}

         {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center gap-4 text-emerald-600 text-sm font-bold shadow-2xl backdrop-blur-xl">
               <CheckCircle2 className="w-6 h-6 shrink-0" />
               <span>{success}</span>
               <button onClick={() => setSuccess(null)} className="ml-auto opacity-50 text-emerald-400 hover:text-emerald-600"><X className="w-4 h-4" /></button>
            </motion.div>
         )}

         <AnimatePresence mode="wait">
            <motion.div 
              key={currentStage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentStage === 0 && <SourcesView files={files} handleFileUpload={handleFileUpload} uploadLoading={uploadLoading} />}
              {currentStage === 1 && (
                <PipelineBuilder 
                  joins={joins} 
                  files={files} 
                  activeColumns={activeColumns}
                  addJoinStep={addJoinStep}
                  removeJoinStep={removeJoinStep}
                  updateJoin={updateJoin}
                  addKeyPair={addKeyPair}
                  removeKeyPair={removeKeyPair}
                  updateKey={updateKey}
                  updateTransformation={updateTransformation}
                  showTransforms={showTransforms}
                  setShowTransforms={setShowTransforms}
                  getFileColumns={getFileColumns}
                  getStepLeftColumns={getStepLeftColumns}
                />
              )}
              {currentStage === 2 && <ReviewView previewData={previewData} metrics={metrics} saveProject={saveProject} />}
            </motion.div>
         </AnimatePresence>
      </main>

      <ActionBar 
        currentStage={currentStage} 
        setCurrentStage={setCurrentStage} 
        files={files} 
        executeChain={executeChain} 
        executeLoading={executeLoading} 
        handleDownload={handleDownload} 
        finalResultId={finalResultId}
      />


      <footer className="max-w-7xl mx-auto mt-24 pt-12 border-t border-[#0F0842]/5 opacity-30 text-center">
         <p className="text-[10px] font-black uppercase tracking-[0.8em] text-[#0F0842]/40 mb-2">Designed for Intelligence</p>
         <p className="text-[8px] font-bold text-[#0F0842]/30">ForgeJoin Unified Pipeline Logic v3.0.42 • Restricted Distribution</p>
      </footer>
    </div>
  );
}

export default App;
