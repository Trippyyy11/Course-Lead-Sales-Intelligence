import React, { useState, useEffect, useRef, useMemo, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { motion, AnimatePresence, color } from 'framer-motion';
import {
  Upload, Table, Download, Settings, FileText,
  AlertCircle, CheckCircle2, Plus, Trash2,
  ArrowRight, Layers, Sparkles, Database, X,
  Shredder, User, Mail, Lock, ShieldCheck, LogOut, KeyRound,
  MoreVertical, Share2, Info, Minus, Calendar, Zap, Check, RefreshCw,
  Folder, ShieldAlert
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for tailwind classes */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// Add a request interceptor to dynamically attach the token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
            (type === 'left' || type === 'outer' || type === 'left_anti' || type === 'full_anti') ? activeCircle : (type === 'inner' ? "fill-none stroke-white/10" : dimCircle)
          )}
        />
        {/* Circle B */}
        <circle
          cx="100" cy="50" r="35"
          className={cn(
            baseCircle,
            (type === 'right' || type === 'outer' || type === 'right_anti' || type === 'full_anti') ? activeCircle : (type === 'inner' ? "fill-none stroke-white/10" : dimCircle)
          )}
        />

        <defs>
          <clipPath id="clipA"><circle cx="60" cy="50" r="35" /></clipPath>
          <clipPath id="clipB"><circle cx="100" cy="50" r="35" /></clipPath>
          <clipPath id="clipIntersection">
            <circle cx="60" cy="50" r="35" clipPath="url(#clipB)" />
          </clipPath>
          <mask id="maskAOnly">
             <rect x="0" y="0" width="160" height="100" fill="white" />
             <circle cx="100" cy="50" r="35" fill="black" />
          </mask>
          <mask id="maskBOnly">
             <rect x="0" y="0" width="160" height="100" fill="white" />
             <circle cx="60" cy="50" r="35" fill="black" />
          </mask>
        </defs>

        {/* Base Circles (Dimmed/Background) */}
        <circle cx="60" cy="50" r="35" className={cn(baseCircle, type === 'inner' ? "fill-none" : dimCircle)} />
        <circle cx="100" cy="50" r="35" className={cn(baseCircle, type === 'inner' ? "fill-none" : dimCircle)} />

        {/* Highlights */}
        {/* Left Side Highlight */}
        {(type === 'left' || type === 'outer' || type === 'left_anti' || type === 'full_anti') && (
          <circle cx="60" cy="50" r="35" className="fill-blue-500/80 stroke-none" mask={type === 'left_anti' || type === 'full_anti' ? "url(#maskAOnly)" : undefined} />
        )}

        {/* Right Side Highlight */}
        {(type === 'right' || type === 'outer' || type === 'right_anti' || type === 'full_anti') && (
          <circle cx="100" cy="50" r="35" className="fill-blue-500/80 stroke-none" mask={type === 'right_anti' || type === 'full_anti' ? "url(#maskBOnly)" : undefined} />
        )}

        {/* Intersection Highlight (For Non-Anti Joins) */}
        {(type === 'inner' || type === 'left' || type === 'right' || type === 'outer') && (
          <circle
            cx="60" cy="50" r="35"
            clipPath="url(#clipB)"
            className="fill-blue-700/90 stroke-none"
          />
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

function CustomSelect({ label, value, options, onChange, placeholder, variant = 'green', className, disabled, rightElement }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, position: 'bottom' });
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        setCoords({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          position: spaceBelow < 250 && spaceAbove > spaceBelow ? 'top' : 'bottom'
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
      <div className="flex items-center justify-between px-1">
        {label && <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>}
        {rightElement}
      </div>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "text-left flex items-center justify-between group transition-all duration-300",
            "bg-[#2a2a2a] border rounded-2xl px-4 py-2.5 text-sm w-full text-white placeholder:text-gray-500", 
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

function FileActions({ onDownload, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-[120]" onClick={() => setShowMenu(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 mt-2 w-48 bg-[#1a1c1e] border border-white/10 rounded-2xl shadow-2xl z-[130] p-1.5 overflow-hidden"
            >
              {onDownload && (
                <button 
                  onClick={() => { onDownload(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold text-gray-400 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-3"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
              )}
              {onDelete && (
                <button 
                  onClick={() => { onDelete(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold text-gray-400 hover:bg-rose-600 hover:text-white transition-all flex items-center gap-3"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const STAGES = [
  { id: 0, name: 'Data Sources', icon: Database, desc: 'Import and manage datasets' },
  { id: 1, name: 'Mapping Logic', icon: Settings, desc: 'Define relations and rules' },
  { id: 2, name: 'Data Review', icon: Table, desc: 'Validate synthesized output' }
];

function GlobalProgress({ activeTask, onCancel }) {
  if (!activeTask) return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[200] w-full max-w-2xl px-6"
    >
      <div className="bg-[#1a1c1e] p-8 rounded-[32px] border-2 border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-blue-500/40 to-transparent" />
        
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex flex-col gap-1">
             <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">
               Current Operation
             </span>
             <span className="text-sm font-bold text-white">
               {activeTask.message || 'Processing'}...
             </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
              Progress
            </span>
            <span className="text-sm font-black text-white">{activeTask.progress}%</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden ring-1 ring-white/5 border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${activeTask.progress}%` }}
              className="h-full bg-linear-to-r from-blue-600 to-indigo-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300"
            />
          </div>
          
          <button 
            onClick={() => onCancel(activeTask.id)}
            className="flex items-center gap-2 px-6 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95 shrink-0"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function DownloadModal({ isOpen, onClose, onConfirm, filename, setFilename }) {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0F0842]/40 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md glass-card p-10 ring-1 ring-white/10 shadow-3xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-white tracking-tight">Export Result</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">File Name</label>
            <div className="relative group">
              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                autoFocus
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Enter filename (optional)"
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-white placeholder:text-gray-600 font-bold"
                onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
              />
            </div>
            <p className="text-[10px] text-gray-500 font-medium px-2">The file will be exported as a compressed .ZIP for maximum efficiency.</p>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" /> Start Download
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function Stepper({ currentStage, setCurrentStage, files }) {
  return (
    <div className="flex flex-col gap-2 relative">
      <div className="absolute left-[23px] top-6 bottom-6 w-px bg-white/5 -z-10" />
      {STAGES.map((s, i) => {
        const isActive = currentStage === s.id;
        const isDisabled = files.length < 2 && s.id > 0;
        
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => !isDisabled || s.id === 0 ? setCurrentStage(s.id) : null}
            disabled={isDisabled}
            className={cn(
              "flex items-center gap-4 px-3 py-3 rounded-2xl transition-all duration-500 relative text-left group",
              isActive ? "text-white" : "text-gray-500 hover:text-white hover:translate-x-2",
              isDisabled && "opacity-20 cursor-not-allowed"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="stepper-active"
                className="absolute inset-0 bg-blue-500/10 rounded-2xl ring-1 ring-blue-500/50 shadow-xl z-0"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <div className={cn("w-12 h-12 rounded-full flex justify-center items-center shrink-0 shadow-lg transition-all duration-500 relative z-10", isActive ? "bg-blue-500 text-white shadow-blue-500/30 ring-2 ring-[rgba(59,130,246,0.5)]" : "bg-[#111] text-gray-500 ring-1 ring-white/10 group-hover:ring-white/20 group-hover:bg-[#1a1a1a] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]")}>
              <s.icon className="w-5 h-5 relative z-10" />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
               <span className={cn("text-[11px] font-black uppercase tracking-widest block truncate transition-colors", isActive ? "text-white" : "text-gray-400 group-hover:text-white")}>
                 {s.name}
               </span>
               <span className="text-[9px] text-gray-500 font-medium tracking-wide mt-1 block truncate opacity-70 group-hover:opacity-100 transition-opacity">
                 {s.desc}
               </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ActionBar({ currentStage, setCurrentStage, files, executeChain, executeLoading, handleDownload, finalResultId }) {
  return (
    <div className="fixed bottom-10 left-[calc(50%+140px)] -translate-x-1/2 flex items-center gap-2 p-1.5 bg-[#202124]/60 backdrop-blur-2xl border border-white/10 rounded-full z-50 shadow-[0_24px_48px_rgba(0,0,0,0.5)] scale-110">
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
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
                        {f.rows?.toLocaleString() || 0} Rows | {f.cols || f.columns?.length || 0} Columns
                      </p>
                    </div>
                  </div>
                  <FileActions 
                    onDelete={() => setDeleteConfirm(f)}
                    onDownload={() => {
                      const token = localStorage.getItem('token');
                      window.open(`${API_BASE}/files/download/${f.id}?token=${token}`, '_blank');
                    }}
                  />
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

function MultiJoinStep({ config, updateConfig, files, getFileColumns, onShowGuide }) {
  const commonColumns = useMemo(() => {
    if (!config.baseFile) return [];
    let intersected = getFileColumns(config.baseFile);
    
    config.targetFiles.forEach(targetId => {
      const targetCols = getFileColumns(targetId);
      if (targetCols.length > 0) {
        intersected = intersected.filter(c => targetCols.includes(c));
      }
    });

    return intersected.sort();
  }, [config.baseFile, config.targetFiles, getFileColumns]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative"
    >
      <div className="absolute -left-4 top-0 bottom-0 w-1 bg-blue-500/30 rounded-full" />

      <div className="glass-card p-10 ring-1 ring-blue-500/20 relative overflow-visible shadow-2xl bg-blue-500/[0.02]">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-2xl">
              <Zap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Multi-File Merge</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Join up to 5 datasets in a single operation</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onShowGuide}
            className="p-3 text-blue-500 hover:bg-blue-500/10 rounded-2xl transition-all"
            title="Join Explanation Guide"
          >
            <Info className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CustomSelect
              label="Primary Base Dataset"
              value={config.baseFile}
              options={files.map(f => ({ value: f.id, label: f.name }))}
              onChange={(val) => updateConfig({ baseFile: val })}
            />

            <CustomSelect
              label="Common Join Key"
              value={config.commonKey}
              options={commonColumns.map(c => ({ value: c, label: c }))}
              onChange={(val) => updateConfig({ commonKey: val })}
              placeholder="Select shared field..."
            />

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Strategy</label>
              <div className="relative">
                 <select 
                   value={config.type}
                   onChange={(e) => updateConfig({ type: e.target.value })}
                   className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                 >
                   <option value="inner" className="bg-[#1a1c1e]">Inner Join (Matches Only)</option>
                   <option value="left" className="bg-[#1a1c1e]">Left Join (Keep All A)</option>
                   <option value="right" className="bg-[#1a1c1e]">Right Join (Keep All B)</option>
                   <option value="outer" className="bg-[#1a1c1e]">Full Outer Join (Keep All)</option>
                   <option value="append" className="bg-[#1a1c1e]">Append All (Stacking)</option>
                   <option value="left_anti" className="bg-[#1a1c1e]">Left Anti (A without B)</option>
                   <option value="right_anti" className="bg-[#1a1c1e]">Right Anti (B without A)</option>
                 </select>
                 <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                   <Settings className="w-4 h-4" />
                 </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Target Datasets ({config.targetFiles.length})</label>
              <button 
                onClick={() => {
                  const allOtherIds = files.filter(f => f.id !== config.baseFile).map(f => f.id);
                  const isAllSelected = config.targetFiles.length === allOtherIds.length;
                  updateConfig({ targetFiles: isAllSelected ? [] : allOtherIds });
                }}
                className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
              >
                {config.targetFiles.length === files.filter(f => f.id !== config.baseFile).length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {files.filter(f => f.id !== config.baseFile).map(file => (
                <button
                  key={file.id}
                  onClick={() => {
                    const newTargets = config.targetFiles.includes(file.id) 
                      ? config.targetFiles.filter(id => id !== file.id)
                      : [...config.targetFiles, file.id];
                    updateConfig({ targetFiles: newTargets });
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-xs font-bold",
                    config.targetFiles.includes(file.id) 
                      ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/10" 
                      : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/10"
                  )}
                >
                  {config.targetFiles.includes(file.id) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 opacity-40" />}
                  <span className="truncate max-w-[150px]">{file.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PipelineBuilder({
  joins, files, activeColumns, addJoinStep, removeJoinStep,
  updateJoin, addKeyPair, removeKeyPair, updateKey,
  updateTransformation, showTransforms, setShowTransforms, getFileColumns, getStepLeftColumns,
  activeTask, onShowGuide,
  joinApproach, setJoinApproach,
  multiJoinConfig, setMultiJoinConfig
}) {
  return (
    <div className="stage-container animate-in fade-in slide-in-from-bottom-4 duration-500 text-white pt-8 lg:pt-16">
      <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black flex items-center gap-3">
              <Settings className="w-6 h-6 text-blue-500" /> Pipeline Configuration
            </h2>
            <p className="text-xs text-gray-500 font-medium tracking-wide flex items-center gap-1.5 ml-9">
              DESIGN YOUR DATA FLOW & RELATIONSHIPS
            </p>
          </div>

          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
            <button
              onClick={() => setJoinApproach('chain')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black transition-all",
                joinApproach === 'chain' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "text-gray-500 hover:text-white"
              )}
            >
              CHAIN APPROACH
            </button>
            <button
              onClick={() => setJoinApproach('multi')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black transition-all",
                joinApproach === 'multi' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "text-gray-500 hover:text-white"
              )}
            >
              MULTI-FILE MERGE
            </button>
          </div>

          {joinApproach === 'chain' && (
            <button
              type="button"
              onClick={addJoinStep}
              className="glass-button bg-blue-600 text-white flex items-center gap-2 text-xs py-2 shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" /> Add Join Step
            </button>
          )}
        </div>

        <div className="space-y-12">
          {joinApproach === 'chain' ? (
            joins.map((join, index) => (
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
                  {index === 0 && (
                    <button 
                      type="button" 
                      onClick={onShowGuide}
                      className="p-3 text-blue-500 hover:bg-blue-500/10 rounded-2xl transition-all ml-2"
                      title="Join Explanation Guide"
                    >
                      <Info className="w-6 h-6" />
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
                          { value: 'full_anti', label: 'Everything excluding matches' },
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
                          {join.type === 'outer' && "Combines everything. Fills gaps with everything where matches aren't found."}
                          {join.type === 'full_anti' && "Keeps only rows that exist in one dataset but NOT both (Symmetric Difference)."}
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
            ))
          ) : (
            <MultiJoinStep 
              config={multiJoinConfig} 
              updateConfig={(updates) => setMultiJoinConfig(prev => ({ ...prev, ...updates }))}
              files={files}
              getFileColumns={getFileColumns}
              onShowGuide={onShowGuide}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function JoinGuideModal({ isOpen, onClose }) {
  const joinTypes = [
    {
      id: 'inner',
      name: 'Inner Join',
      desc: 'Only keeps records that have matching keys in BOTH datasets.',
      useCase: 'Finding customers who have placed at least one order.',
      icon: <Layers className="w-6 h-6" />
    },
    {
      id: 'left',
      name: 'Left Join',
      desc: 'Keeps all records from Dataset A, and adds matching data from B where available.',
      useCase: 'Listing all products and their sales (even if they havent sold yet).',
      icon: <ArrowRight className="w-6 h-6" />
    },
    {
      id: 'right',
      name: 'Right Join',
      desc: 'Keeps all records from Dataset B, and adds matching data from A where available.',
      useCase: 'Listing all sales agents and their corresponding branch info.',
      icon: <ArrowRight className="w-6 h-6 rotate-180" />
    },
    {
      id: 'outer',
      name: 'Full Outer Join',
      desc: 'Keeps everything from both datasets. Fills missing values with nulls.',
      useCase: 'Creating a master list of all contacts from two different regional databases.',
      icon: <Database className="w-6 h-6" />
    },
    {
      id: 'left_anti',
      name: 'Left Anti Join',
      desc: 'Keeps only records in A that have NO match in B.',
      useCase: 'Finding customers who have NEVER placed an order.',
      icon: <X className="w-6 h-6" />
    },
    {
      id: 'right_anti',
      name: 'Right Anti Join',
      desc: 'Keeps only records in B that have NO match in A.',
      useCase: 'Finding products in inventory that have zero sales records.',
      icon: <X className="w-6 h-6" />
    },
    {
      id: 'full_anti',
      name: 'Full Anti Join',
      desc: 'Keeps records that are unique to either dataset (excludes all matches).',
      useCase: 'Identifying records that exist in either system but not both.',
      icon: <Minus className="w-6 h-6" />
    },
    {
      id: 'append',
      name: 'Append',
      desc: 'Simply stacks rows from both datasets on top of each other.',
      useCase: 'Combining two monthly sales reports into one continuous list.',
      icon: <Plus className="w-6 h-6" />
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 50 }}
            className="relative w-full max-w-5xl h-[80vh] bg-[#1a1c1e] rounded-[48px] border border-white/10 shadow-3xl overflow-hidden flex flex-col"
          >
            <div className="p-8 lg:p-12 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h2 className="text-4xl font-black text-white mb-2 italic">Data Join Guide</h2>
                <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.3em]">Mastering harmonization strategies</p>
              </div>
              <button
                onClick={onClose}
                className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all group"
              >
                <X className="w-6 h-6 text-gray-500 group-hover:text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {joinTypes.map((j) => (
                  <div key={j.id} className="p-8 rounded-[32px] bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all group">
                    <div className="flex items-start gap-6 mb-6">
                      <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                        {j.icon}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white mb-1">{j.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{j.id}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed mb-6 font-medium">
                      {j.desc}
                    </p>
                    <div className="pt-6 border-t border-white/5">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Example Use Case</p>
                      <p className="text-xs text-blue-300/70 font-bold leading-relaxed">{j.useCase}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function DateRangePicker({ value, onChange, min, max }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const start = value?.start || "";
  const end = value?.end || "";

  const presets = [
    { label: "Today", getRange: () => {
      const d = new Date().toISOString().split('T')[0];
      return { start: d, end: d };
    }},
    { label: "Last 7 Days", getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 7);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }},
    { label: "This Month", getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }},
    { label: "Custom Only", getRange: () => ({ start: "", end: "" }) }
  ];

  const handleApply = (newRange) => {
    onChange(newRange);
    setIsOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between bg-[#1a1c1e] border rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none transition-all cursor-pointer",
          value ? "border-blue-500 text-blue-400" : "border-white/5 text-gray-400 hover:border-white/20"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {value ? `${start || '?'} to ${end || '?'}` : "Select Range"}
          </span>
        </div>
        {value && <X onClick={clear} className="w-2.5 h-2.5 hover:text-white" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-0 top-full mt-2 w-64 bg-[#1a1c1e] border border-white/10 rounded-2xl shadow-2xl z-[100] p-4 space-y-4"
          >
            <div className="space-y-2">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Quick Suggestions</p>
              <div className="grid grid-cols-2 gap-2">
                {presets.map(p => (
                  <button
                    key={p.label}
                    onClick={() => handleApply(p.getRange())}
                    className="text-[10px] font-bold py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-blue-500/20 hover:border-blue-500/30 text-gray-300 hover:text-blue-400 transition-all text-left"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/5">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Custom Auto Range</p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-gray-600 ml-1">START DATE</label>
                  <input
                    type="date"
                    min={min}
                    max={max}
                    value={start}
                    onChange={(e) => onChange({ ...value, start: e.target.value })}
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-gray-600 ml-1">END DATE</label>
                  <input
                    type="date"
                    min={min}
                    max={max}
                    value={end}
                    onChange={(e) => onChange({ ...value, end: e.target.value })}
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold mt-2 shadow-lg shadow-blue-500/20 transition-all"
              >
                Apply Range
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReviewView({ previewData, metrics, saveProject, droppedResultColumns, setDroppedResultColumns, onApplyColumnDrops, columnFilters, setColumnFilters, onClearFilters }) {
  const handleToggleColumn = (col) => {
    if (droppedResultColumns.includes(col)) {
      setDroppedResultColumns(droppedResultColumns.filter(c => c !== col));
    } else {
      setDroppedResultColumns([...droppedResultColumns, col]);
    }
  };

  const visibleColumns = previewData ? previewData.columns.filter(c => !droppedResultColumns.includes(c)) : [];

  return (
    <div className="stage-container animate-in fade-in slide-in-from-bottom-4 duration-500 text-white pt-8 lg:pt-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        <div className="lg:col-span-2 space-y-10">
          
          {/* Manage Output Columns Section */}
          {previewData && (
            <section className="glass-card p-10 ring-1 ring-white/5 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-xl font-black flex items-center gap-3">
                    <Settings className="w-5 h-5 text-indigo-400" /> Manage Output Columns
                  </h3>
                  <p className="text-xs text-gray-400 font-bold mt-1">Select columns to exclude from the final download</p>
                </div>
                {droppedResultColumns.length > 0 && (
                  <button 
                    onClick={onApplyColumnDrops}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-full shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-2 animate-in slide-in-from-right-4"
                  >
                    <Trash2 className="w-4 h-4" /> Apply Deletions ({droppedResultColumns.length})
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {previewData.columns.map(col => {
                  const isDropped = droppedResultColumns.includes(col);
                  return (
                    <button
                      key={col}
                      onClick={() => handleToggleColumn(col)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 group",
                        isDropped 
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20" 
                          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                      )}
                    >
                      {isDropped ? (
                        <span className="flex items-center gap-1 opacity-70 group-hover:opacity-100"><Plus className="w-3 h-3" /> Restore</span>
                      ) : (
                        <span className="flex items-center gap-1"><X className="w-3 h-3 opacity-50 group-hover:opacity-100" /> Keep</span>
                      )}
                      <span className={isDropped ? "line-through opacity-70" : ""}>{col}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="glass-card overflow-hidden ring-1 ring-white/5">
            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h2 className="text-3xl font-black flex items-center gap-4">
                  <Table className="w-8 h-8 text-blue-400" /> Result Preview
                </h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">First 50 synthesized records</p>
              </div>
              <div className="flex items-center gap-4">
                {Object.values(columnFilters).some(v => v) && (
                  <button
                    onClick={onClearFilters}
                    className="text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest flex items-center gap-2 px-4 py-2 bg-rose-500/10 rounded-full transition-all"
                  >
                    <X className="w-3 h-3" /> Clear Filters
                  </button>
                )}
                {previewData && (
                  <div className="text-xs font-bold text-blue-400 bg-blue-500/10 px-4 py-2 rounded-full ring-1 ring-blue-500/20">
                    Showing {visibleColumns.length} of {previewData.columns.length} columns
                  </div>
                )}
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
                      {visibleColumns.map(col => (
                        <th key={col} className="px-8 py-5 text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            <span>{col}</span>
                            <div className="relative group/filter">
                              {previewData.column_info && previewData.column_info[col] && previewData.column_info[col].type === 'date' ? (
                                <DateRangePicker
                                  value={columnFilters[col]}
                                  min={previewData.column_info[col].min?.split('T')[0]}
                                  max={previewData.column_info[col].max?.split('T')[0]}
                                  onChange={(val) => setColumnFilters({ ...columnFilters, [col]: val })}
                                />
                              ) : (
                                <>
                                  <select
                                    value={columnFilters[col] || ""}
                                    onChange={(e) => setColumnFilters({ ...columnFilters, [col]: e.target.value })}
                                    className="w-full bg-[#1a1c1e] border border-white/5 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white focus:border-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
                                  >
                                    <option value="">All</option>
                                    {previewData.unique_values && previewData.unique_values[col] && previewData.unique_values[col].map(val => (
                                      <option key={val} value={val}>{val}</option>
                                    ))}
                                  </select>
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                                    <Plus className="w-2.5 h-2.5 rotate-45" />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-transparent">
                    {previewData.data.map((row, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors group">
                        {visibleColumns.map(col => (
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
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 glass-subcard !rounded-2xl border border-blue-500/10">
                      <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Rows</p>
                      <span className="text-xl font-black text-white">{metrics.row_count?.toLocaleString() || 0}</span>
                   </div>
                   <div className="p-6 glass-subcard !rounded-2xl border border-indigo-500/10">
                      <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">Cols</p>
                      <span className="text-xl font-black text-white">{metrics.col_count || 0}</span>
                   </div>
                </div>

                {[
                  { label: "Missing Values", value: metrics.null_count, color: "text-amber-400", icon: AlertCircle },
                  { label: "Duplicates", value: metrics.duplicate_count, color: "text-rose-400", icon: Trash2 },
                ].map((m, i) => (
                  <div key={i} className="p-8 glass-subcard !rounded-[32px]">
                    <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3">{m.label}</p>
                    <span className={cn("text-3xl sm:text-4xl font-black block break-all leading-none", m.color)}>{m.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 opacity-20 text-xs font-bold italic uppercase tracking-widest leading-relaxed">Metrics unavailable</div>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
}

function AdminDashboard({ user, onClose }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'logs'
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'EMPLOYEE' });
  const [createLoading, setCreateLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [clearLogsLoading, setClearLogsLoading] = useState(false);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uResp, lResp] = await Promise.all([
        axios.get(`${API_BASE}/admin/users`),
        axios.get(`${API_BASE}/admin/audit-logs`)
      ]);
      setUsers(uResp.data.users);
      setLogs(lResp.data.logs);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to fetch admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Small delay to ensure axios headers are set if coming from a fresh refresh
    const timer = setTimeout(() => {
      fetchData();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenu && !e.target.closest('.portal-menu-content') && !e.target.closest('.user-actions-btn')) {
        setOpenMenu(null);
      }
    };
    const handleScrollOrResize = () => setOpenMenu(null);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openMenu]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await axios.post(`${API_BASE}/admin/users`, newUser);
      setSuccess(`User ${newUser.email} created successfully`);
      setNewUser({ email: '', full_name: '', password: '', role: 'EMPLOYEE' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create user");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateUser = async (updatedData) => {
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/admin/users/${editingUser.email}`, updatedData);
      setSuccess(`User ${editingUser.email} updated successfully`);
      setEditingUser(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/admin/users/${deletingUser.email}`);
      setSuccess(`User ${deletingUser.email} deleted permanently`);
      setDeletingUser(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Deletion failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    setClearLogsLoading(true);
    setConfirmClearLogs(false);
    try {
      const resp = await axios.delete(`${API_BASE}/admin/audit-logs`);
      setSuccess(resp.data.message || "Logs archived and cleared");
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to clear logs");
    } finally {
      setClearLogsLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-10">
        <div className="flex flex-col gap-2 text-left">
           <h2 className="text-3xl font-black text-white tracking-tight">Administrative Hub</h2>
           <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">Manage Personnel & Audit Trails</p>
        </div>

        {error && (
          <div className="flex-1 max-w-md mx-6 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
             <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex-1 max-w-md mx-6 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{success}</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button 
            onClick={fetchData}
            disabled={loading}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={cn("w-4 h-4 text-gray-400", loading && "animate-spin")} />
          </button>
          <button 
            onClick={onClose}
            className="p-3 bg-white/5 hover:bg-rose-500/10 rounded-xl transition-all group"
            title="Exit Admin"
          >
            <X className="w-4 h-4 text-gray-400 group-hover:text-rose-500" />
          </button>
          <div className="flex p-1 bg-white/5 rounded-2xl ring-1 ring-white/5">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn("px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'users' ? "bg-white text-black" : "text-gray-500 hover:text-white")}
            >
              Users
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={cn("px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'logs' ? "bg-white text-black" : "text-gray-500 hover:text-white")}
            >
              Audit Logs
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1">
            <div className="glass-card p-10 ring-1 ring-white/10 shadow-3xl">
              <h3 className="text-lg font-black text-white mb-8">Provision Employee</h3>
              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Full Name</label>
                  <input required type="text" value={newUser.full_name} onChange={e=>setNewUser({...newUser, full_name: e.target.value})} className="glass-input !rounded-2xl" placeholder="Emily Carter" />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Work Email</label>
                  <input required type="email" value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})} className="glass-input !rounded-2xl" placeholder="emily@corp.com" />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Access Key</label>
                  <input required type="password" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})} className="glass-input !rounded-2xl" placeholder="••••••••" />
                </div>
                <div className="space-y-4 text-left">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Authority Role</label>
                  <CustomSelect
                    value={newUser.role}
                    onChange={(val) => setNewUser({...newUser, role: val})}
                    options={[
                      { value: 'EMPLOYEE', label: 'Employee' },
                      { value: 'ADMIN', label: 'Administrator' },
                      { value: 'SUPERADMIN', label: 'Superadmin' }
                    ]}
                    variant="blue"
                  />
                </div>
                <button disabled={createLoading} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-xl shadow-blue-500/20 active:scale-95">
                  {createLoading ? "Processing..." : "Grant Access"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="glass-card ring-1 ring-white/10 shadow-3xl overflow-hidden min-h-[500px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Identity</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Authorized By</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Joined</th>
                      {user?.role === 'SUPERADMIN' && <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                      <tr key={u.email} className="hover:bg-white/5 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 font-black">{u.full_name[0]}</div>
                            <div>
                              <p className="text-sm font-bold text-white leading-none mb-1">{u.full_name}</p>
                              <p className="text-xs text-gray-500 font-medium">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-sm">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            u.role === 'SUPERADMIN' ? "bg-indigo-500/20 text-indigo-400" : u.role === 'ADMIN' ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-gray-400"
                          )}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                           <p className="text-[11px] font-bold text-blue-400/80">{u.authorized_by_name || 'System'}</p>
                        </td>
                        <td className="px-8 py-6 text-right text-xs text-gray-500 font-medium">{new Date(u.created_at).toLocaleDateString()}</td>
                        {user?.role === 'SUPERADMIN' && (
                          <td className="px-8 py-6 text-right user-actions-btn">
                            {/* Hide actions for other SUPERADMIN accounts */}
                            {u.role !== 'SUPERADMIN' && (
                              <button 
                                onClick={(e) => {
                                  if (openMenu?.email === u.email) {
                                    setOpenMenu(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setOpenMenu({ email: u.email, user: u, rect });
                                  }
                                }}
                                className={cn(
                                  "p-2 rounded-xl transition-all",
                                  openMenu?.email === u.email ? "bg-white/10 text-white" : "text-gray-500 hover:text-white hover:bg-white/5"
                                )}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card ring-1 ring-white/10 shadow-3xl overflow-hidden min-h-[600px]">
          {/* Logs header with delete button */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{logs.length} entries</p>
            {user?.role === 'SUPERADMIN' && (
              confirmClearLogs ? (
                <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-200">
                  <span className="text-[10px] text-gray-400 font-bold">PDF will be emailed to you first. Confirm?</span>
                  <button onClick={handleClearLogs} disabled={clearLogsLoading} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                    {clearLogsLoading ? 'Clearing...' : 'Yes, Archive & Clear'}
                  </button>
                  <button onClick={() => setConfirmClearLogs(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearLogs(true)}
                  className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Archive & Clear Logs
                </button>
              )
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Timestamp</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {logs.map((l, i) => (
                  <tr key={i} className={cn("hover:bg-white/5 transition-colors", l.is_suspicious ? "bg-rose-500/[0.03]" : "")}>
                    <td className="px-8 py-5 text-[11px] text-gray-500 font-medium">{new Date(l.created_at || l.timestamp).toLocaleString()}</td>
                    <td className="px-8 py-5 text-sm text-blue-400 font-bold">{l.user_email}</td>
                    <td className="px-8 py-5">
                      <span className={cn("text-[11px] font-black uppercase tracking-wider", l.is_suspicious ? "text-rose-400" : "text-white")}>
                        {l.action.replace(/_/g, ' ')}
                      </span>
                      {l.is_suspicious && (
                        <span className="ml-2 inline-flex items-center gap-1 text-rose-500 text-[9px] font-black uppercase tracking-widest animate-pulse">
                          <AlertCircle className="w-3 h-3" /> Suspicious
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {openMenu && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: openMenu.rect.top + openMenu.rect.height / 2,
                left: openMenu.rect.left - 16,
                transform: 'translate(-100%, -50%)',
                zIndex: 9999
              }}
              className="w-52 glass-card backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl py-2 overflow-hidden ring-1 ring-white/5 portal-menu-content"
            >
              <div className="px-4 py-2 border-b border-white/5 mb-1">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest text-left">Account Controls</p>
              </div>
              <button
                onClick={() => {
                  setEditingUser(openMenu.user);
                  setOpenMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-all text-left group"
              >
                <Settings className="w-3.5 h-3.5 group-hover:text-blue-400 transition-colors" />
                Modify Account
              </button>
              <button
                onClick={() => {
                  if (openMenu.user.email !== user.email) {
                    setDeletingUser(openMenu.user);
                    setOpenMenu(null);
                  }
                }}
                disabled={openMenu.user.email === user.email}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all text-left",
                  openMenu.user.email === user.email 
                    ? "opacity-20 cursor-not-allowed text-gray-600" 
                    : "text-gray-400 hover:text-rose-500 hover:bg-rose-500/10"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Permanently
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {editingUser && (
          <EditUserModal 
            user={editingUser} 
            onClose={() => setEditingUser(null)} 
            onConfirm={handleUpdateUser} 
          />
        )}
        {deletingUser && (
          <DeleteUserConfirmModal 
            user={deletingUser} 
            onClose={() => setDeletingUser(null)} 
            onConfirm={handleDeleteUser} 
          />
        )}
      </AnimatePresence>
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
              {stage === 'otp' ? (
                <KeyRound className="w-8 h-8 text-blue-500" />
              ) : (
                <ShieldCheck className="w-8 h-8 text-blue-500" />
              )}
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

          {/* Auth Error / Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-rose-400">{typeof error === 'object' ? JSON.stringify(error) : error}</p>
                </div>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-400">{success}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {stage === 'otp' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="mb-10 flex flex-col items-center"
              >
                <div className="relative group">
                  <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full group-hover:bg-blue-500/30 transition-all duration-700" />
                  <img 
                    src="/image-1.png" 
                    alt="OTP Verification" 
                    className="w-27 h-auto relative z-10 drop-shadow-[0_20px_50px_rgba(59,130,246,0.2)] group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
  const [activeTask, setActiveTask] = useState(null); // { id, type, progress, message }
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

  const [joinApproach, setJoinApproach] = useState('chain'); // 'chain' or 'multi'
  const [multiJoinConfig, setMultiJoinConfig] = useState({
    baseFile: '',
    targetFiles: [],
    commonKey: '',
    type: 'inner'
  });

  const [metrics, setMetrics] = useState(null); // Health metrics for final result
  const [showTransforms, setShowTransforms] = useState({}); // Track expanded transforms by joinId
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id: string, name: string }
  const [user, setUser] = useState(null);
  const [authStage, setAuthStage] = useState('login'); // login, signup, otp
  const [authLoading, setAuthLoading] = useState(false);
  const [authData, setAuthData] = useState({ email: '', password: '', confirm_password: '', full_name: '', otp: '' });
  const [clearConfirm, setClearConfirm] = useState(false);
  const [downloadModal, setDownloadModal] = useState({ show: false, resultId: null });
  const [downloadFilename, setDownloadFilename] = useState('');
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [colDeleteConfirm, setColDeleteConfirm] = useState(null); // { name: string }
  const uploadController = useRef(null);
  const activeTaskIdRef = useRef(null);
  const [showJoinGuide, setShowJoinGuide] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);


  useEffect(() => {
    activeTaskIdRef.current = activeTask?.id;
  }, [activeTask]);

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
    setLogoutConfirm(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setLogoutConfirm(false);
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
  const [columnFilters, setColumnFilters] = useState({});
  

  const [droppedResultColumns, setDroppedResultColumns] = useState([]); // Track dropped columns in final review

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Handle live preview filtering
  useEffect(() => {
    if (currentStage === 2 && finalResultId) {
      const delayDebounceFn = setTimeout(async () => {
        try {
          const params = new URLSearchParams();
          if (Object.keys(columnFilters).length > 0) {
            params.append('filters', JSON.stringify(columnFilters));
          }
          const token = localStorage.getItem('token');
          const previewResp = await axios.get(`${API_BASE}/preview/${finalResultId}?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setPreviewData(previewResp.data);
          setMetrics(previewResp.data.metrics);
        } catch (err) {
          console.error("Failed to filter preview:", err);
        }
      }, 500); // 500ms debounce
      return () => clearTimeout(delayDebounceFn);
    }
  }, [columnFilters, finalResultId, currentStage]);

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
    const taskId = 'upload_' + Date.now();
    setActiveTask({ id: taskId, type: 'system', progress: 10, message: 'Uploading Datasets' });
    
    // Setup abort controller for this upload
    uploadController.current = new AbortController();

    try {
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file);
      });
      
      await axios.post(`${API_BASE}/upload`, formData, {
        signal: uploadController.current.signal,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
          setActiveTask({ id: taskId, type: 'system', progress, message: 'Uploading Datasets' });
        }
      });
      
      const resp = await axios.get(`${API_BASE}/files`);
      setFiles(resp.data.files);
      setSuccess(`${uploadedFiles.length} file(s) uploaded successfully`);
      
      setActiveTask({ id: taskId, type: 'system', progress: 100, message: 'Upload Complete' });
      setTimeout(() => {
        setActiveTask(prev => prev?.id === taskId ? null : prev);
      }, 1000);

    } catch (err) {
      if (axios.isCancel(err)) {
        setSuccess('Upload cancelled');
      } else {
        setError(err.response?.data?.detail || 'Upload failed');
      }
      setActiveTask(null);
    } finally {
      setUploadLoading(false);
      setUploadProgress(0);
      uploadController.current = null;
    }
  };

  const handleTaskCancel = async (taskId) => {
    // If it's a pending state or upload, handle locally first
    if (!taskId || taskId === 'pending') {
      setActiveTask(null);
      return;
    }

    if (taskId.startsWith('upload_')) {
      if (uploadController.current) {
        uploadController.current.abort();
      }
      setActiveTask(null);
      return;
    }

    // Immediately stop UI feedback
    setActiveTask(null);
    setSuccess('Stopping operation...');

    try {
      await axios.delete(`${API_BASE}/tasks/${taskId}`);
    } catch (err) {
      console.error('Failed to cancel task on server:', err);
    }
  };

  const handleApplyColumnDrops = async () => {
    if (!finalResultId || droppedResultColumns.length === 0) return;
    
    setActiveTask({ id: 'drop_cols', type: 'system', progress: 50, message: 'Updating Columns...' });
    
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.delete(`${API_BASE}/result/${finalResultId}/columns`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { columns: droppedResultColumns }
      });
      
      setPreviewData({ data: resp.data.data, columns: resp.data.columns });
      setMetrics(resp.data.metrics);
      setDroppedResultColumns([]);
      setSuccess(resp.data.message || 'Columns updated successfully');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update columns');
    } finally {
      setActiveTask(null);
    }
  };

  const handleFileDelete = async (fileId) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      setDeleteConfirm(file);
    }
  };

  const confirmFileDelete = async (fileId) => {
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
    setDeleteConfirm(null);

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

  const pollTask = async (taskId, type) => {
    const messageBase = type === 'join' ? 'Synthesizing Step' : 'Saving Collection';
    setActiveTask({ id: taskId, type: type, progress: 0, message: messageBase });
    
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        // Stop if this task is no longer the active one according to the Ref
        if (activeTaskIdRef.current !== taskId) {
          clearInterval(interval);
          resolve(null);
          return;
        }

        try {
          const { data } = await axios.get(`${API_BASE}/tasks/${taskId}`);
          
          if (activeTaskIdRef.current !== taskId) {
            clearInterval(interval);
            resolve(null);
            return;
          }

          if (data.status === 'completed') {
            setActiveTask({ id: taskId, type: type, progress: 100, message: `${messageBase} Complete` });
            clearInterval(interval);
            
            // Settle time
            setTimeout(async () => {
              setActiveTask(null);
              if (type === 'save') {
                setSaveModal(false);
                setCollectionName("");
                const listResp = await axios.get(`${API_BASE}/collections`);
                setCollections(listResp.data.collections);
                setSuccess('Collection saved successfully!');
              }
              resolve(data.result);
            }, 800);

          } else if (data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(interval);
            setActiveTask(null);
            if (data.status === 'failed') {
              setError(data.error || "Operation failed");
              reject(new Error(data.error));
            } else {
              setSuccess("Operation cancelled");
              resolve(null); // Return null to signal cancellation
            }
          } else {
            setActiveTask({ id: taskId, type: type, progress: data.progress, message: data.message || messageBase });
          }
        } catch (err) {
          clearInterval(interval);
          setActiveTask(null);
          setError("Error tracking progress.");
          reject(err);
        }
      }, 250);
    });
  };

  const saveCollection = async () => {
    if (!collectionName.trim()) {
      setError("Please enter a collection name.");
      return;
    }
    const config = { joins };
    try {
      const resp = await axios.post(`${API_BASE}/collections`, {
        name: collectionName,
        config: config,
        result_id: finalResultId || null
      });
      
      if (resp.data.task_id) {
        setActiveTask({ id: resp.data.task_id, type: 'save', progress: 5, message: 'Initiating Collection Sync...' });
        pollTask(resp.data.task_id, 'save');
      } else {
        setSuccess(`Collection "${collectionName}" saved!`);
        setSaveModal(false);
        setCollectionName("");
        const listResp = await axios.get(`${API_BASE}/collections`);
        setCollections(listResp.data.collections);
      }
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
    setColumnFilters({}); // Reset filters on new execution

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

        // Construct query parameters
        const params = new URLSearchParams();
        params.append('file_a_id', leftId);
        params.append('file_b_id', step.fileB);
        step.keysA.forEach(k => params.append('keys_a', k));
        step.keysB.forEach(k => params.append('keys_b', k));
        params.append('join_type', step.type);

        // Don't set activeTask here with dummy ID, pollTask will handle it
        const resp = await axios.post(`${API_BASE}/join?${params.toString()}`, step.transformations);
        const taskId = resp.data.task_id;
        
        // Final check if user cancelled while we were waiting for the post request
        if (!activeTask && i === 0) {
           // If user clicked cancel during the post, we should stop
           // But actually pollTask will handle it by checking the status
        }

        const stepResult = await pollTask(taskId, 'join');
        
        // If stepResult is null, it means the task was cancelled
        if (!stepResult) {
          setExecuteLoading(false);
          return;
        }

        currentResultId = stepResult.result_id;
        lastCols = stepResult.columns;
        if (i === joins.length - 1) {
          setMetrics({ 
            ...stepResult.metrics, 
            row_count: stepResult.row_count, 
            col_count: stepResult.col_count 
          });
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
      setActiveTask(null);
    } finally {
      setExecuteLoading(false);
    }
  };

  const executeMulti = async () => {
    setExecuteLoading(true);
    setError(null);
    setPreviewData(null);
    setSuccess(null);
    setColumnFilters({});

    try {
      if (!multiJoinConfig.baseFile) throw new Error("Please select a Primary Base Dataset");
      if (multiJoinConfig.targetFiles.length === 0) throw new Error("Please select at least one Target Dataset");
      if (!multiJoinConfig.commonKey) throw new Error("Please select a Common Join Key");

      const params = new URLSearchParams();
      params.append('base_file_id', multiJoinConfig.baseFile);
      multiJoinConfig.targetFiles.forEach(id => params.append('target_file_ids', id));
      params.append('common_key', multiJoinConfig.commonKey);
      params.append('join_type', multiJoinConfig.type);

      const resp = await axios.post(`${API_BASE}/join/multi?${params.toString()}`);
      const taskId = resp.data.task_id;

      const stepResult = await pollTask(taskId, 'join');
      if (!stepResult) {
        setExecuteLoading(false);
        return;
      }

      setMetrics({ 
        ...stepResult.metrics, 
        row_count: stepResult.row_count, 
        col_count: stepResult.col_count 
      });

      setFinalResultId(stepResult.result_id);
      setActiveColumns(stepResult.columns);

      const previewResp = await axios.get(`${API_BASE}/preview/${stepResult.result_id}`);
      setPreviewData(previewResp.data);
      setSuccess('Multi-file merge executed successfully!');
      setCurrentStage(2);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Multi-merge failed');
      setActiveTask(null);
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

  const handleDownload = async () => {
    if (!finalResultId) return;
    setActiveTask({ id: 'export', type: 'system', progress: 10, message: 'Synthesizing Export' });
    if (!finalResultId) {
      setError("No result available to download.");
      return;
    }
    setDownloadFilename(`pipeline_result_${Date.now()}`);
    setDownloadModal({ show: true, resultId: finalResultId });
  };

  const triggerFinalDownload = async () => {
    const { resultId } = downloadModal;
    let name = downloadFilename.trim();
    setDownloadModal({ show: false, resultId: null });
    
    if (!name) name = `result_${Date.now()}`;
    const cleanName = name.replace(/\.(csv|zip|xls|xlsx|forge)$/i, '');
    
    try {
      setSuccess("Preparing your file...");
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('filename', cleanName);
      params.append('token', token);
      if (Object.keys(columnFilters).length > 0) {
        params.append('filters', JSON.stringify(columnFilters));
      }
      const downloadUrl = `${API_BASE}/download/${resultId}?${params.toString()}`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${cleanName}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setActiveTask(null);
    } catch (err) {
      setError("Download failed. Please try again.");
      setActiveTask(null);
    }
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
    <div className="min-h-screen relative flex">
      <aside className="fixed left-0 top-0 bottom-0 w-72 bg-[#0A0A0A]/95 backdrop-blur-2xl border-r border-white/5 flex flex-col z-[100]">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => { setShowAdmin(false); setShowCollections(false); }}>
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center ring-1 ring-white/10 group-hover:ring-blue-500/20 transition-all duration-500">
               <Shredder className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">DataForge</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
           {!showAdmin && !showCollections && (
             <Stepper currentStage={currentStage} setCurrentStage={setCurrentStage} files={files} />
           )}
           {(showAdmin || showCollections) && (
             <button 
               onClick={() => { setShowAdmin(false); setShowCollections(false); }}
               className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-[11px] font-black uppercase tracking-widest"
             >
               <ArrowRight className="w-4 h-4 rotate-180" /> Back to Pipeline
             </button>
           )}
        </div>

        <div className="p-4 border-t border-white/5 space-y-2">
           <button 
             onClick={() => setSaveModal(true)} 
             className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-emerald-500 hover:bg-emerald-500/10 transition-all"
           >
             <Download className="w-4 h-4" /> Save Collection
           </button>

           <button 
             onClick={() => { setShowAdmin(false); setShowCollections(true); }} 
             className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all", showCollections ? "bg-white/10 text-white shadow-inner" : "text-gray-500 hover:text-white hover:bg-white/5")}
           >
             <Folder className="w-4 h-4" /> Library
           </button>
           
           {(user?.role === 'SUPERADMIN' || user?.role === 'ADMIN') && (
             <button 
               onClick={() => { setShowCollections(false); setShowAdmin(!showAdmin); }} 
               className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all", showAdmin ? "bg-blue-600 shadow-lg shadow-blue-500/20 text-white" : "text-gray-500 hover:text-white hover:bg-white/5")}
             >
               <ShieldAlert className="w-4 h-4" /> Admin Console
             </button>
           )}
           
           <div className="pt-2 mt-2 border-t border-white/5">
             <button
               onClick={handleLogout}
               className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all text-[11px] font-black uppercase tracking-widest"
             >
               <LogOut className="w-4 h-4" /> Sign Out
             </button>
           </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-[280px] w-full relative min-h-screen flex flex-col">
        <GlobalProgress activeTask={activeTask} onCancel={handleTaskCancel} />

        {currentStage === 0 && !showAdmin && !showCollections && (
          <div className="pt-16 pb-8 px-6 md:px-12 text-center space-y-4 relative shrink-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/20 blur-[140px] rounded-full -z-10 pointer-events-none" />
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000">
              Course Lead <br />
              <span className="gemini-text">Intelligence Pipeline</span>
            </h1>
            <p className="text-gray-400 text-sm md:text-lg font-medium max-w-xl mx-auto opacity-80">
              Join, clean, and transform your sales lead datasets <br />
              with precision and ease.
            </p>
          </div>
        )}

        <main className={cn("max-w-7xl mx-auto w-full flex-1 px-6 pb-20 relative z-10 flex flex-col", !(currentStage === 0 && !showAdmin && !showCollections) ? "pt-16 lg:pt-20" : "pt-4")}>
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

        <JoinGuideModal isOpen={showJoinGuide} onClose={() => setShowJoinGuide(false)} />

        <AnimatePresence mode="wait">
          {showAdmin ? (
            <AdminDashboard key="admin" user={user} onClose={() => setShowAdmin(false)} />
          ) : (
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
                  activeTask={activeTask}
                  onShowGuide={() => setShowJoinGuide(true)}
                  joinApproach={joinApproach}
                  setJoinApproach={setJoinApproach}
                  multiJoinConfig={multiJoinConfig}
                  setMultiJoinConfig={setMultiJoinConfig}
                />
              )}
              {currentStage === 2 && (
                <ReviewView 
                  previewData={previewData} 
                  metrics={metrics} 
                  saveProject={saveProject}
                  droppedResultColumns={droppedResultColumns}
                  setDroppedResultColumns={setDroppedResultColumns}
                  onApplyColumnDrops={handleApplyColumnDrops}
                  columnFilters={columnFilters}
                  setColumnFilters={setColumnFilters}
                  onClearFilters={() => setColumnFilters({})}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!showAdmin && (
        <ActionBar
          currentStage={currentStage}
          setCurrentStage={setCurrentStage}
          files={files}
          executeChain={joinApproach === 'chain' ? executeChain : executeMulti}
          executeLoading={executeLoading}
          handleDownload={handleDownload}
          finalResultId={finalResultId}
        />
      )}

      {/* Collections Library Modal */}
      <AnimatePresence>
        {showCollections && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCollections(false)} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl glass-card p-0 ring-1 ring-white/10 shadow-3xl overflow-hidden">
              <div className="p-10 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white">Project Library</h3>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Manage datasets and collections</p>
                </div>
                <button onClick={() => setShowCollections(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all text-gray-500 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-10 pt-8 space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                <div className="space-y-3">
                  <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Saved Collections</h4>
                  {collections.length === 0 ? (
                    <div className="py-10 text-center opacity-10 flex flex-col items-center gap-4 text-white">
                      <Layers className="w-12 h-12" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.5em]">No Collections</p>
                    </div>
                  ) : (
                    collections.map(col => (
                      <div key={col.name} className="flex items-center justify-between p-5 bg-[#2a2a2a] border border-[#333333] rounded-2xl group hover:border-[#444444] transition-all">
                        <div className="flex items-center gap-5">
                          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <Database className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white mb-1">{col.name}</h4>
                            <p className="text-[10px] text-gray-500 font-medium italic">{col.config?.joins?.length || 0} join steps</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileActions 
                            onDelete={() => setColDeleteConfirm(col)}
                            onDownload={() => {
                              if (col.has_result) {
                                const token = localStorage.getItem('token');
                                window.open(`${API_BASE}/collections/download/${encodeURIComponent(col.name)}?token=${token}`, '_blank');
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 mb-8">
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    finalResultId ? "bg-emerald-500 shadow-[0_0_10_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_10_rgba(245,158,11,0.5)]"
                  )} />
                  <div>
                    <p className="text-xs font-bold text-white">
                      {finalResultId ? "Includes Joined Result (ZIP)" : "Pipeline Configuration Only"}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {finalResultId ? "The current join output will be compressed and stored." : "Run the pipeline first to include the generated result file."}
                    </p>
                  </div>
                </div>
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
              </div>
              <div className="grid grid-cols-2 gap-4 mt-10">
                <button
                  onClick={() => setSaveModal(false)}
                  className="py-4 rounded-2xl font-bold text-gray-500 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCollection}
                  disabled={!!activeTask}
                  className="py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  Confirm Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DownloadModal
        isOpen={downloadModal.show}
        onClose={() => {
          setDownloadModal({ show: false, resultId: null });
          setActiveTask(null);
        }}
        filename={downloadFilename}
        setFilename={setDownloadFilename}
        onConfirm={triggerFinalDownload}
      />

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

        {logoutConfirm && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLogoutConfirm(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-card p-10 ring-1 ring-white/10 shadow-3xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/50" />
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-8">
                <LogOut className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Sign Out?</h3>
              <p className="text-sm text-gray-400 mb-10 font-medium leading-relaxed">
                Are you sure you want to end your session? You will need to sign in again to access your data pipeline.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setLogoutConfirm(false)}
                  className="py-4 px-6 rounded-2xl font-bold text-gray-400 hover:bg-white/5 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="py-4 px-6 rounded-2xl font-bold bg-white text-black hover:bg-gray-100 transition-all shadow-lg"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {colDeleteConfirm && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setColDeleteConfirm(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
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
              <h3 className="text-2xl font-black text-white mb-3">Delete Collection?</h3>
              <p className="text-sm text-gray-400 mb-10 font-medium leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-white">"{colDeleteConfirm.name}"</span>? This action is permanent and cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setColDeleteConfirm(null)}
                  className="py-4 px-6 rounded-2xl font-bold text-gray-400 hover:bg-white/5 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await axios.delete(`${API_BASE}/collections/${encodeURIComponent(colDeleteConfirm.name)}`);
                      setCollections(prev => prev.filter(c => c.name !== colDeleteConfirm.name));
                      setSuccess(`Collection "${colDeleteConfirm.name}" deleted.`);
                    } catch (err) {
                      // If 404, still remove from UI (stale entry)
                      if (err.response?.status === 404) {
                        setCollections(prev => prev.filter(c => c.name !== colDeleteConfirm.name));
                        setSuccess(`Collection "${colDeleteConfirm.name}" removed.`);
                      } else {
                        setError("Failed to delete collection.");
                      }
                    } finally {
                      setColDeleteConfirm(null);
                    }
                  }}
                  className="py-4 px-6 rounded-2xl font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md glass-card p-10 ring-1 ring-white/10 shadow-3xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/50" />
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-8">
                <FileText className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Remove Dataset?</h3>
              <p className="text-sm text-gray-400 mb-10 font-medium leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-white">"{deleteConfirm.name}"</span>? This will reset any pipeline steps using this file.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="py-4 px-6 rounded-2xl font-bold text-gray-400 hover:bg-white/5 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmFileDelete(deleteConfirm.id)}
                  className="py-4 px-6 rounded-2xl font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                >
                  Confirm Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl w-full mx-auto mt-32 pb-16 border-t border-white/5 opacity-40 text-center">
        
        <p className="text-[9px] font-bold text-gray-500 tracking-wider">ForgeJoin Unified Pipeline Logic v3.1.0 • Next-Gen Synthesis Engine</p>
      </footer>
      </div>
    </div>
  );
}

export default App;

function EditUserModal({ user, onClose, onConfirm }) {
  const [formData, setFormData] = useState({ 
    full_name: user.full_name, 
    role: user.role 
  });

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md glass-card p-10 ring-1 ring-white/10 shadow-3xl overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-white tracking-tight italic">Modify Account</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500/50 transition-all text-sm text-white font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Access Role</label>
            <div className="flex p-1 bg-black/40 rounded-2xl ring-1 ring-white/5">
              {['SUPERADMIN', 'ADMIN', 'EMPLOYEE'].map(r => (
                <button
                  key={r}
                  onClick={() => setFormData({...formData, role: r})}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    formData.role === r ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-500 hover:text-white"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <button onClick={onClose} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(formData)}
              className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
            >
              Update User
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function DeleteUserConfirmModal({ user, onClose, onConfirm }) {
  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md glass-card p-10 ring-1 ring-white/10 shadow-3xl overflow-hidden">
        <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-8 mx-auto">
          <Trash2 className="w-8 h-8 text-rose-500" />
        </div>
        
        <div className="text-center space-y-4 mb-10">
          <h3 className="text-2xl font-black text-white tracking-tight italic">Confirm Permanent Deletion</h3>
          <p className="text-sm text-gray-400 font-medium leading-relaxed">
            Are you sure you want to delete <span className="text-white font-bold">{user.email}</span>? This action is irreversible and the user will lose all access immediately.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-500 transition-all shadow-xl shadow-rose-500/20 active:scale-[0.98]"
          >
            Permanently Delete
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
