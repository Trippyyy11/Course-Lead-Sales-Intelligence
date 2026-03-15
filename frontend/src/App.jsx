import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { motion, AnimatePresence, color } from 'framer-motion';
import {
  Upload, Table, Download, Settings, FileText,
  AlertCircle, CheckCircle2, Plus, Trash2,
  ArrowRight, Layers, Sparkles, Database, X,
  Shredder, User, Mail, Lock, ShieldCheck, LogOut
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for tailwind classes */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const API_BASE = 'http://localhost:8000';

/** Custom Select Component for Premium UI */
/** Visual Representation of Join Types */
function JoinDiagram({ type }) {
  const baseCircle = "stroke-white/10 fill-none transition-all duration-500";
  const activeCircle = "fill-blue-500/40 stroke-blue-500/60 transition-all duration-500";
  const dimCircle = "fill-white/5 stroke-white/10 transition-all duration-500";

  return (
    <div className="flex flex-col items-center gap-3 p-5 glass-subcard !bg-[#1a1c1e] justify-center relative group w-full max-w-[220px] h-[140px] mx-auto">
      <svg width="100%" height="100%" viewBox="0 0 160 100" className="drop-shadow-[0_0_15px_rgba(37,99,235,0.2)]">
        {/* Circle A */}
        <circle
          cx="60" cy="50" r="35"
          className={cn(
            baseCircle,
            (type === 'left' || type === 'outer' || type === 'left_anti') ? activeCircle : (type === 'inner' ? "fill-none stroke-white/10" : dimCircle)
          )}
        />
        {/* Circle B */}
        <circle
          cx="100" cy="50" r="35"
          className={cn(
            baseCircle,
            (type === 'right' || type === 'outer' || type === 'right_anti') ? activeCircle : (type === 'inner' ? "fill-none stroke-white/10" : dimCircle)
          )}
        />

        <defs>
          <clipPath id="clipA"><circle cx="60" cy="50" r="35" /></clipPath>
          <clipPath id="clipB"><circle cx="100" cy="50" r="35" /></clipPath>
          <clipPath id="clipAOnly">
            <rect x="0" y="0" width="160" height="100" />
            <circle cx="100" cy="50" r="35" className="fill-black" />
          </clipPath>
          <clipPath id="clipBOnly">
            <rect x="0" y="0" width="160" height="100" />
            <circle cx="60" cy="50" r="35" className="fill-black" />
          </clipPath>
        </defs>

        {/* Intersection Highlight */}
        {(type === 'inner' || type === 'left' || type === 'right' || type === 'outer') && (
          <circle
            cx="60" cy="50" r="35"
            clipPath="url(#clipB)"
            className="fill-blue-500/80 stroke-none transition-all duration-500"
          />
        )}

        {/* Anti-Join Highlights */}
        {type === 'left_anti' && (
          <circle cx="60" cy="50" r="35" className="fill-blue-500/80 stroke-none transition-all duration-500" clipPath="url(#clipAOnly)" />
        )}
        {type === 'right_anti' && (
          <circle cx="100" cy="50" r="35" className="fill-blue-500/80 stroke-none transition-all duration-500" clipPath="url(#clipBOnly)" />
        )}

        {/* Append Logic */}
        {type === 'append' && (
          <g transform="translate(45, 15)">
            <rect width="70" height="30" rx="4" className="fill-blue-500/40 stroke-blue-500/60 animate-bounce" />
            <rect y="40" width="70" height="30" rx="4" className="fill-blue-500/80 stroke-blue-500/60" />
          </g>
        )}
      </svg>
      <div className="absolute top-2 left-2 flex gap-1 items-center opacity-30 group-hover:opacity-100 transition-opacity">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-[9px] font-black uppercase text-blue-500 tracking-wider">Visual Guide</span>
      </div>
    </div>
  );
}

function CustomSelect({ label, value, options, onChange, placeholder, disabled, className, variant = 'blue' }) {
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
              <div className="px-4 py-3 text-xs text-gray-500 italic text-center">No options available</div>
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
                      ? "bg-blue-600 text-white font-bold"
                      : "text-gray-400 hover:bg-white/10 hover:text-white hover:translate-x-1"
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
    <div className={cn("space-y-2 w-full relative", className)} ref={containerRef}>
      {label && <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block ml-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "text-left flex items-center justify-between group transition-all duration-300",
            "bg-[#2a2a2a] border rounded-xl px-4 py-2.5 text-sm w-full text-white placeholder:text-gray-500", // Manually expanded .glass-input logic for better control
            disabled && "opacity-50 cursor-not-allowed",
            isOpen
              ? (variant === 'blue' ? "!border-blue-500/70 !bg-blue-500/15 ring-1 ring-blue-500/20" : "!border-green-500/70 !bg-green-500/20 ring-1 ring-green-500/20")
              : (selectedOption
                ? (variant === 'blue' ? "!border-yellow-500/50 !bg-yellow-500/10" : "!border-gray-500/60 !bg-gray-500/15")
                : "border-[#333333] hover:border-white/20")
          )}
        >
          <span className={cn("truncate font-bold transition-colors", !selectedOption ? "text-white/30" : "text-white")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Settings className={cn(
              "w-3.5 h-3.5 transition-colors",
              selectedOption
                ? (variant === 'blue' ? "text-blue-400" : "text-green-400")
                : "text-gray-500 group-hover:text-blue-400"
            )} />
          </motion.div>
        </button>

        {isOpen && createPortal(menuContent, document.body)}
      </div>
    </div>
  );
}

const STAGES = [
  { id: 0, name: 'Data Sources', icon: Database },
  { id: 1, name: 'Mapping Logic', icon: Settings },
  { id: 2, name: 'Data Review', icon: Table }
];

function Stepper({ currentStage, setCurrentStage, files }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-white/5 rounded-full backdrop-blur-md border border-white/5 ring-1 ring-white/5">
      {STAGES.map((s, i) => (
        <React.Fragment key={s.id}>
          <button
            type="button"
            onClick={() => files.length >= 2 || s.id === 0 ? setCurrentStage(s.id) : null}
            disabled={files.length < 2 && s.id > 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
              currentStage === s.id ? "bg-white text-black shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5",
              files.length < 2 && s.id > 0 && "opacity-30 cursor-not-allowed"
            )}
          >
            <s.icon className={cn("w-3.5 h-3.5", currentStage === s.id ? "text-blue-600" : "")} />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden md:block">{s.name}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function ActionBar({ currentStage, setCurrentStage, files, executeChain, executeLoading, handleDownload, finalResultId }) {
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-[#202124]/60 backdrop-blur-2xl border border-white/10 rounded-full z-50 shadow-[0_24px_48px_rgba(0,0,0,0.5)] scale-110">
      <button
        type="button"
        disabled={currentStage === 0}
        onClick={() => setCurrentStage(prev => prev - 1)}
        className="px-6 py-3 rounded-full text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 disabled:opacity-20"
      >
        <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Previous
      </button>

      <div className="h-6 w-px bg-white/10 mx-2" />

      {currentStage < 2 ? (
        <button
          type="button"
          disabled={files.length < 2}
          onClick={() => {
            if (currentStage === 1) executeChain();
            else setCurrentStage(prev => prev + 1);
          }}
          className="px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest bg-white text-black hover:bg-gray-200 transition-all shadow-xl flex items-center gap-2 active:scale-95 disabled:opacity-50"
        >
          {currentStage === 1 ? (executeLoading ? 'Executing...' : 'Run Pipeline') : 'Next Stage'}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleDownload}
          disabled={!finalResultId}
          className="px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" /> Export Result
        </button>
      )}
    </div>
  );
}

function SourcesView({ files, handleFileUpload, uploadLoading, uploadProgress, handleFileDelete, deleteConfirm, setDeleteConfirm, onClearAll }) {
  return (
    <div className="stage-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <section className="glass-card p-10 ring-1 ring-white/5">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-black flex items-center gap-4 text-white">
              <Upload className="w-8 h-8 text-blue-500" /> Import Data
            </h2>
          </div>
          <div className="relative group">
            <input
              type="file" multiple onChange={handleFileUpload} accept=".csv,.xls,.xlsx"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="border-2 border-dashed border-white/5 rounded-[32px] p-16 text-center group-hover:border-blue-500/30 group-hover:bg-blue-500/5 transition-all duration-500">
              <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform">
                <FileText className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Select or Drop Files</h3>
              <p className="text-sm text-gray-500 max-w-[240px] mx-auto leading-relaxed">Excel or CSV files supported for harmonization.</p>
            </div>
          </div>
          {uploadLoading && (
            <div className="mt-8 space-y-2">
              <div className="flex justify-between text-[10px] font-black text-[#0F0842] uppercase tracking-widest">
                <span style={{ color: "#f3f3f7ff" }}>Uploading Datasets... {uploadProgress ? `${uploadProgress}%` : ''}</span>
                <span style={{ color: "#f3f3f7ff" }}>Wait a moment</span>
              </div>
              <div className="h-1.5 w-full bg-[#f3f3f7ff]/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress || 10}%` }}
                  transition={{ duration: 0.2 }}
                  className="h-full bg-[#f3f3f7ff] shadow-[0_0_10px_rgba(15,8,66,0.3)] transition-all duration-300"
                />
              </div>
            </div>
          )}
        </section>

        <section className="glass-card p-10 ring-1 ring-white/5 overflow-hidden">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-black flex items-center gap-4 text-white">
              <Database className="w-8 h-8 text-blue-400" /> Active Inventory
            </h2>
            {files.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-all border border-rose-500/20"
              >
                Discard All
              </button>
            )}
          </div>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
            {files.length === 0 ? (
              <div className="py-20 text-center opacity-20 flex flex-col items-center gap-6 text-white">
                <Layers className="w-16 h-16" />
                <p className="text-sm font-bold uppercase tracking-[0.4em]">No Datasets Loaded</p>
              </div>
            ) : (
              files.map(f => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between p-5 glass-subcard group"
                >
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-1">{f.name}</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">{f.columns.length} Columns</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ id: f.id, name: f.name })}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-[#0F0842]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md glass-card p-10 ring-1 ring-white/10 shadow-3xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/50" />
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-8">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Delete Dataset?</h3>
              <p className="text-sm text-gray-400 mb-10 font-medium leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-white">"{deleteConfirm.name}"</span>? This action cannot be undone and will affect any joins using this file.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="py-4 px-6 rounded-2xl font-bold text-gray-400 hover:bg-white/5 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleFileDelete(deleteConfirm.id);
                    setDeleteConfirm(null);
                  }}
                  className="py-4 px-6 rounded-2xl font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PipelineBuilder({
  joins, files, activeColumns, addJoinStep, removeJoinStep,
  updateJoin, addKeyPair, removeKeyPair, updateKey,
  updateTransformation, showTransforms, setShowTransforms, getFileColumns, getStepLeftColumns
}) {
  return (
    <div className="stage-container animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
      <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-500" /> Pipeline Configuration
          </h2>
          <button
            type="button"
            onClick={addJoinStep}
            className="glass-button bg-blue-600 text-white flex items-center gap-2 text-xs py-2 shadow-lg shadow-blue-500/20"
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
              <div className="absolute -left-4 top-0 bottom-0 w-1 bg-white/10 rounded-full" />

              <div className="glass-card p-10 ring-1 ring-white/5 relative overflow-visible shadow-2xl">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center text-xl font-black shadow-2xl">
                      {index + 1}
                    </div>
                    <h3 className="text-xl font-black text-white">Step {index + 1}: {index === 0 ? 'Primary Merge' : 'Chained Merge'}</h3>
                  </div>
                  {joins.length > 1 && (
                    <button type="button" onClick={() => removeJoinStep(join.id)} className="p-3 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all">
                      <Trash2 className="w-6 h-6" />
                    </button>
                  )}
                </div>

                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {index === 0 ? (
                      <CustomSelect
                        label="Base Dataset (A)"
                        value={join.fileA}
                        options={files.map(f => ({ value: f.id, label: f.name }))}
                        onChange={(val) => updateJoin(join.id, 'fileA', val)}
                        placeholder="Choose starting point"
                      />
                    ) : (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 shadow-sm">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Source Dataset</p>
                        <span className="text-xs font-bold italic text-white/50">Previous Step Output</span>
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

                  <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-8 items-start pt-8 border-t border-white/5">
                    <div className="space-y-6">
                      <CustomSelect
                        label="Merge Strategy"
                        variant="indigo"
                        value={join.type}
                        options={[
                          { value: 'inner', label: 'Matching records only' },
                          { value: 'left', label: 'Dataset A + matching items from B' },
                          { value: 'right', label: 'Dataset B + matching items from A' },
                          { value: 'outer', label: 'Everything from both datasets' },
                          { value: 'left_anti', label: 'Only in Dataset A (Unique)' },
                          { value: 'right_anti', label: 'Only in Dataset B (Unique)' },
                          { value: 'append', label: 'Stack rows from both datasets' }
                        ]}
                        onChange={(val) => updateJoin(join.id, 'type', val)}
                        placeholder="Select Logic"
                      />
                      <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                        <p className="text-[10px] text-blue-400 font-bold leading-relaxed">
                          {join.type === 'inner' && "Keeps only rows where keys match in both datasets."}
                          {join.type === 'left' && "Keeps all rows from A, adding matches from B where they exist."}
                          {join.type === 'right' && "Keeps all rows from B, adding matches from A where they exist."}
                          {join.type === 'outer' && "Combines everything. Fills gaps with empty values where matches aren't found."}
                          {join.type === 'left_anti' && "Finds rows in A that have NO match in B."}
                          {join.type === 'right_anti' && "Finds rows in B that have NO match in A."}
                          {join.type === 'append' && "Combines files by stacking rows. Requires sharing same column names."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <JoinDiagram type={join.type} />
                    </div>
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
                        <div className="glass-subcard p-8 space-y-8 !bg-black/40">
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
                                  <div key={old} className="flex items-center gap-3 p-3 glass-subcard !rounded-2xl">
                                    <span className="text-[10px] font-mono text-gray-500 truncate w-24">#{old}</span>
                                    <input
                                      value={curr}
                                      className="bg-transparent text-xs font-bold text-white outline-none flex-1 border-b border-white/10 focus:border-blue-500/50 transition-colors placeholder:text-gray-600"
                                      placeholder="New name..."
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
                                  <div key={col} className="flex items-center justify-between p-3 glass-subcard !rounded-2xl">
                                    <span className="text-[10px] font-mono text-gray-500 truncate w-24">#{col}</span>
                                    <select
                                      value={type}
                                      onChange={(e) => updateTransformation(join.id, 'cast', { ...join.transformations.cast, [col]: e.target.value })}
                                      className="bg-black/40 text-[10px] font-bold text-white outline-none border border-white/10 rounded-lg px-2 py-1"
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
    <div className="stage-container animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
        <div className="xl:col-span-3 space-y-10 pb-32">
          <section className="glass-card overflow-hidden ring-1 ring-white/5">
            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h2 className="text-3xl font-black flex items-center gap-4">
                  <Table className="w-8 h-8 text-blue-400" /> Result Preview
                </h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">First 50 synthesized records</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[700px] custom-scrollbar">
              {!previewData ? (
                <div className="py-40 text-center opacity-20 flex flex-col items-center gap-10">
                  <Sparkles className="w-20 h-20 animate-pulse text-blue-500" />
                  <p className="text-sm font-bold uppercase tracking-[0.5em]">No Data to Display</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-white/5 backdrop-blur-md z-10 sticky top-0 border-b border-white/10">
                      {previewData.columns.map(col => (
                        <th key={col} className="px-8 py-5 text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-transparent">
                    {previewData.data.map((row, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors group">
                        {previewData.columns.map(col => (
                          <td key={`${i}-${col}`} className="px-8 py-4 text-sm font-medium text-gray-300 group-hover:text-white transition-colors whitespace-nowrap">{String(row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <aside className="xl:col-span-1 space-y-8">
          <div className="glass-card p-10 ring-1 ring-white/5 shadow-3xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-8 border-b border-white/5 pb-5">Quality Metrics</h3>
            {metrics ? (
              <div className="space-y-6">
                {[
                  { label: "Missing Values", value: metrics.null_count, color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertCircle },
                  { label: "Duplicates", value: metrics.duplicate_count, color: "text-rose-400", bg: "bg-rose-500/10", icon: Trash2 },
                ].map((m, i) => (
                  <div key={i} className="p-6 glass-subcard !rounded-[24px] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-2">{m.label}</p>
                      <span className={`text-3xl font-black ${m.color}`}>{m.value}</span>
                    </div>
                    <div className={`p-4 ${m.bg} ${m.color} rounded-2xl`}>
                      <m.icon className="w-6 h-6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 opacity-20 text-xs font-bold italic uppercase tracking-widest leading-relaxed">Metrics unavailable</div>
            )}
          </div>

          <button type="button" onClick={saveProject} className="w-full py-5 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 hover:bg-white/10 hover:text-white transition-all shadow-xl">
            <Download className="w-4 h-4" /> Export Config
          </button>
        </aside>
      </div>
    </div>
  );
}

function AuthScreen({ stage, setStage, loading, authData, setAuthData, onSubmit, error, success }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0a] relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-card p-10 ring-1 ring-white/10 shadow-3xl">
          {/* Auth Tabs */}
          <div className="flex p-1.5 bg-white/5 rounded-2xl mb-10 ring-1 ring-white/5">
            <button
              onClick={() => setStage('login')}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                stage === 'login' ? "bg-white text-black shadow-lg" : "text-gray-500 hover:text-white"
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => setStage('signup')}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                stage === 'signup' || stage === 'otp' ? "bg-white text-black shadow-lg" : "text-gray-500 hover:text-white"
              )}
            >
              Sign Up
            </button>
          </div>

          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-blue-500/20">
              <ShieldCheck className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">
              {stage === 'login' && 'Welcome Back'}
              {stage === 'signup' && 'Create Account'}
              {stage === 'otp' && 'Verify Identity'}
            </h2>
            <p className="text-gray-500 text-sm mt-2 font-medium text-center">
              {stage === 'login' && 'Login to access your data pipeline'}
              {stage === 'signup' && 'Start your data journey today'}
              {stage === 'otp' && `Enter the code sent to ${authData.email}`}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            {stage === 'signup' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    required
                    type="text"
                    placeholder="John Doe"
                    className="glass-input !pl-12 !rounded-2xl"
                    value={authData.full_name}
                    onChange={(e) => setAuthData({ ...authData, full_name: e.target.value })}
                  />
                </div>
              </div>
            )}

            {(stage === 'login' || stage === 'signup' || stage === 'otp') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    required
                    type="email"
                    disabled={stage === 'otp'}
                    placeholder="name@company.com"
                    className="glass-input !pl-12 !rounded-2xl disabled:opacity-50"
                    value={authData.email}
                    onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                  />
                </div>
              </div>
            )}

            {(stage === 'login' || stage === 'signup') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className="glass-input !pl-12 !rounded-2xl"
                    value={authData.password}
                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                  />
                </div>
              </div>
            )}

            {stage === 'signup' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className="glass-input !pl-12 !rounded-2xl"
                    value={authData.confirm_password}
                    onChange={(e) => setAuthData({ ...authData, confirm_password: e.target.value })}
                  />
                </div>
              </div>
            )}

            {stage === 'otp' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">6-Digit Code</label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  className="glass-input !rounded-2xl text-center text-2xl font-black tracking-[0.5em] !py-4"
                  value={authData.otp}
                  onChange={(e) => setAuthData({ ...authData, otp: e.target.value })}
                />
              </div>
            )}

            <button
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {stage === 'login' && 'Sign In'}
                  {stage === 'signup' && 'Register Account'}
                  {stage === 'otp' && 'Verify & Complete'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            {stage === 'login' ? (
              <p className="text-xs text-gray-500 font-medium">
                Don't have an account?{' '}
                <button onClick={() => setStage('signup')} className="text-blue-500 font-bold hover:underline">Sign Up</button>
              </p>
            ) : (
              <p className="text-xs text-gray-500 font-medium">
                Already have an account?{' '}
                <button onClick={() => setStage('login')} className="text-blue-500 font-bold hover:underline">Sign In</button>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function App() {
  const [files, setFiles] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id: string, name: string }
  const [user, setUser] = useState(null);
  const [authStage, setAuthStage] = useState('login'); // login, signup, otp
  const [authLoading, setAuthLoading] = useState(false);
  const [authData, setAuthData] = useState({ email: '', password: '', confirm_password: '', full_name: '', otp: '' });
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      setUser(storedUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);

    try {
      if (authStage === 'login') {
        const resp = await axios.post(`${API_BASE}/auth/login`, {
          email: authData.email,
          password: authData.password
        });
        const { access_token, user: userData } = resp.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('user', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        setUser(userData);
        setSuccess(`Welcome back, ${userData.name}!`);
      } else if (authStage === 'signup') {
        await axios.post(`${API_BASE}/auth/request-otp`, authData);
        setAuthStage('otp');
        setSuccess('OTP sent to your email!');
      } else if (authStage === 'otp') {
        await axios.post(`${API_BASE}/auth/verify-signup`, authData);
        setAuthStage('login');
        setSuccess('Account verified! Please login.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setSuccess('Logged out successfully');
  };


  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const resp = await axios.get(`${API_BASE}/files`);
        setFiles(resp.data.files);
      } catch (err) {
        console.error('Failed to fetch files:', err);
      }
    };
    fetchFiles();
  }, []);

  const [previewData, setPreviewData] = useState(null);
  const [finalResultId, setFinalResultId] = useState(null);
  const [activeColumns, setActiveColumns] = useState([]);
  const [collections, setCollections] = useState([]);
  const [showCollections, setShowCollections] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [collectionName, setCollectionName] = useState("");

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const resp = await axios.get(`${API_BASE}/collections`);
        setCollections(resp.data.collections);
      } catch (err) {
        console.error('Failed to fetch collections:', err);
      }
    };
    fetchCollections();
  }, []);

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;

    setUploadLoading(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    uploadedFiles.forEach(file => formData.append('files', file));

    try {
      const resp = await axios.post(`${API_BASE}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      setFiles(prev => [...prev, ...resp.data.files]);
      setSuccess('Datasets imported successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed');
    } finally {
      setUploadLoading(false);
      setUploadProgress(0);
    }
  };

  const handleFileDelete = async (fileId) => {
    try {
      await axios.delete(`${API_BASE}/file/${fileId}`);
    } catch (err) {
      // If 404, the file is already gone from backend (likely server restart)
      // We still want to remove it from frontend state
      if (err.response?.status !== 404) {
        setError(err.response?.data?.detail || 'Delete failed');
        return;
      }
    }

    setFiles(prev => prev.filter(f => f.id !== fileId));
    setSuccess('File removed successfully');

    // Also clean up any join steps that might be using this file
    setJoins(prev => prev.map(j => {
      if (j.fileA === fileId) return { ...j, fileA: '', keysA: [''] };
      if (j.fileB === fileId) return { ...j, fileB: '', keysB: [''] };
      return j;
    }));
  };

  const handleClearAllFiles = async () => {
    try {
      await axios.delete(`${API_BASE}/files/clear`);
      setFiles([]);
      setSuccess('All files discarded successfully');

      // Reset pipeline
      setJoins([{
        id: crypto.randomUUID(),
        fileA: '',
        keysA: [''],
        fileB: '',
        keysB: [''],
        type: 'inner',
        transformations: { drop: [], rename: {}, cast: {} }
      }]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear files');
    }
  };

  const saveCollection = async () => {
    if (!collectionName.trim()) {
      setError("Please enter a collection name.");
      return;
    }
    const config = { joins };
    try {
      await axios.post(`${API_BASE}/collections`, {
        name: collectionName,
        config: config,
        result_id: finalResultId || null
      });
      setSuccess(`Collection "${collectionName}" saved!`);
      setSaveModal(false);
      setCollectionName("");
      // Refresh list
      const resp = await axios.get(`${API_BASE}/collections`);
      setCollections(resp.data.collections);
    } catch (err) {
      setError("Failed to save collection.");
    }
  };

  const loadCollection = (col) => {
    setJoins(col.config.joins);
    setSuccess(`Collection "${col.name}" loaded successfully.`);
    setShowCollections(false);
    setCurrentStage(1); // Jump to pipeline
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

    // Heuristic: Process all previous steps sequentially to determine current schema
    let currentCols = [];

    for (let i = 0; i < stepIndex; i++) {
      const step = joins[i];
      const colsA = i === 0 ? getFileColumns(step.fileA) : currentCols;
      const colsB = getFileColumns(step.fileB);

      // Union of columns (Join logic)
      let combined = [...new Set([...colsA, ...colsB])];

      // Apply transformations (Drops and Renames)
      const renamed = combined.map(c => step.transformations.rename[c] || c);
      currentCols = renamed.filter(c => !step.transformations.drop.includes(c));
    }

    return [...new Set(currentCols)].sort();
  };

  const handleDownload = () => {
    if (!finalResultId) return;
    window.open(`${API_BASE}/download/${finalResultId}`, '_blank');
  };

  const getFileColumns = (fileId) => {
    const file = files.find(f => f.id === fileId);
    return file ? file.columns : [];
  };

  if (!user) {
    return (
      <AuthScreen
        stage={authStage}
        setStage={setAuthStage}
        loading={authLoading}
        authData={authData}
        setAuthData={setAuthData}
        onSubmit={handleAuthSubmit}
        error={error}
        success={success}
      />
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Enhanced Background system is now handled purely via CSS body backgrounds for smoother transitions */}

      <header className="pill-nav max-w-fit mx-auto">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 pl-2 pr-4 border-r border-white/10 group cursor-pointer">
            <div className="w-9 h-9 bg-black rounded-full flex items-center justify-center ring-1 ring-white/20 group-hover:ring-blue-500/50 transition-all">

              <Shredder className="w-6 h-6 text-blue-500 animate-pulse" />
            </div>
            <span className="text-sm font-black tracking-tight text-white hidden sm:block">DataForge</span>
          </div>

          <Stepper currentStage={currentStage} setCurrentStage={setCurrentStage} files={files} />

          <div className="flex items-center gap-2 pr-1">
            <button onClick={() => setShowCollections(true)} className="px-5 py-2 text-[11px] font-bold text-gray-300 hover:text-white transition-colors">
              Library
            </button>
            <button onClick={() => setSaveModal(true)} className="px-5 py-2 text-[14px] font-bold bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              Save Collection
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="pt-32 pb-16 text-center space-y-4">
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1]">
          Synergize your data with <br />
          <span className="gemini-text">Next-gen AI Pipeline</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl font-medium max-w-2xl mx-auto">
          Experience the most capable data harmonization engine <br />
          built for speed and precision.
        </p>
      </div>

      <main className="max-w-7xl mx-auto min-h-[60vh]">
        {/* Toast Notifications */}
        <div className="toast-container">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                className="toast-pill toast-error group"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">{typeof error === 'object' ? JSON.stringify(error) : error}</span>
                <button onClick={() => setError(null)} className="ml-2 p-1 hover:bg-white/10 rounded-full transition-all">
                  <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                </button>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                className="toast-pill toast-success group"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">{success}</span>
                <button onClick={() => setSuccess(null)} className="ml-2 p-1 hover:bg-white/10 rounded-full transition-all">
                  <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStage === 0 && (
              <SourcesView
                files={files}
                handleFileUpload={handleFileUpload}
                uploadLoading={uploadLoading}
                uploadProgress={uploadProgress}
                handleFileDelete={handleFileDelete}
                deleteConfirm={deleteConfirm}
                setDeleteConfirm={setDeleteConfirm}
                onClearAll={() => setClearConfirm(true)}
              />
            )}
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

      {/* Collections Library Modal */}
      <AnimatePresence>
        {showCollections && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCollections(false)} className="absolute inset-0 bg-[#0F0842]/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl glass-card p-10 ring-1 ring-white/10 shadow-3xl">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-black text-white">Stored Collections</h3>
                <button onClick={() => setShowCollections(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all text-gray-500 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                {collections.length === 0 ? (
                  <div className="py-20 text-center opacity-10 flex flex-col items-center gap-6 text-white">
                    <Layers className="w-16 h-16" />
                    <p className="text-sm font-bold uppercase tracking-[0.5em]">No Collections Found</p>
                  </div>
                ) : (
                  collections.map(col => (
                    <div key={col.name} className="flex items-center justify-between p-6 bg-[#2a2a2a] border border-[#333333] rounded-2xl group hover:border-[#444444] transition-all shadow-md">
                      <div className="flex items-center gap-5">
                        <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400">
                          <Database className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-[15px] font-bold text-white mb-1">{col.name}</h4>
                          <p className="text-[11px] text-gray-500 font-medium italic">{JSON.stringify(col.config.joins.length)} join steps</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadCollection(col)}
                          className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-all active:scale-95"
                        >
                          Load
                        </button>
                        {col.has_result && (
                          <button
                            onClick={() => window.open(`${API_BASE}/collections/download/${col.name}`, '_blank')}
                            className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-all active:scale-95 flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" /> Result
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              await axios.delete(`${API_BASE}/collections/${col.name}`);
                              setCollections(prev => prev.filter(c => c.name !== col.name));
                            } catch (err) {
                              console.error("Delete failed:", err);
                            }
                          }}
                          className="p-3 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Collection Modal */}
      <AnimatePresence>
        {saveModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSaveModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md glass-card p-10 relative z-10">
              <h3 className="text-2xl font-black text-white mb-6">Save Pipeline</h3>
              <p className="text-sm text-gray-500 mb-8 font-medium">Store current configuration as a collection.</p>
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Collection Name</label>
                  <input
                    type="text"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    placeholder="e.g. Q1 Sales Harmonization"
                    className="glass-input !rounded-2xl !p-5 font-bold text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button onClick={() => setSaveModal(false)} className="py-4 font-bold text-gray-400 hover:bg-white/5 rounded-2xl transition-all border border-white/5">Cancel</button>
                  <button onClick={saveCollection} className="py-4 font-bold bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all">Save Config</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear All Confirmation Modal */}
      <AnimatePresence>
        {clearConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClearConfirm(false)}
              className="absolute inset-0 bg-[#0F0842]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md glass-card p-10 ring-1 ring-white/10 shadow-3xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/50" />
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-8">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Discard All Files?</h3>
              <p className="text-sm text-gray-400 mb-10 font-medium leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-white">ALL uploaded datasets</span>? This action cannot be undone and will reset your pipeline configuration.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setClearConfirm(false)}
                  className="py-4 px-6 rounded-2xl font-bold text-gray-400 hover:bg-white/5 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleClearAllFiles();
                    setClearConfirm(false);
                  }}
                  className="py-4 px-6 rounded-2xl font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                >
                  Discard All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto mt-32 pb-16 border-t border-white/5 opacity-40 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.8em] text-white/60 mb-3">Designed for Intelligence</p>
        <p className="text-[9px] font-bold text-gray-500 tracking-wider">ForgeJoin Unified Pipeline Logic v3.1.0 • Next-Gen Synthesis Engine</p>
      </footer>
    </div>
  );
}

export default App;
