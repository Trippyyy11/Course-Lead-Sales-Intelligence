import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Table, Download, Settings, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [files, setFiles] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Join Configuration
  const [fileA, setFileA] = useState('');
  const [fileB, setFileB] = useState('');
  const [keyA, setKeyA] = useState('');
  const [keyB, setKeyB] = useState('');
  const [joinType, setJoinType] = useState('inner');

  // Result Preview
  const [previewData, setPreviewData] = useState(null);
  const [resultId, setResultId] = useState(null);

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
      setSuccess('Files uploaded successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!fileA || !fileB || !keyA || !keyB) {
      setError('Please select files and join keys');
      return;
    }

    setJoinLoading(true);
    setError(null);
    setPreviewData(null);

    try {
      const resp = await axios.post(`${API_BASE}/join?file_a_id=${fileA}&file_b_id=${fileB}&key_a=${keyA}&key_b=${keyB}&join_type=${joinType}`);
      setResultId(resp.data.result_id);
      
      // Fetch preview
      const previewResp = await axios.get(`${API_BASE}/preview/${resp.data.result_id}`);
      setPreviewData(previewResp.data);
      setSuccess('Data joined successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Join failed');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultId) return;
    window.open(`${API_BASE}/download/${resultId}`, '_blank');
  };

  const getFileColumns = (fileId) => {
    const file = files.find(f => f.id === fileId);
    return file ? file.columns : [];
  };

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          No-Code Data Joiner
        </h1>
        <p className="text-secondary mt-2 text-lg">Upload, join, and download your data effortlessly.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Config */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Section */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-blue-500" /> Upload Files
            </h2>
            <div className="relative group">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                accept=".csv,.xls,.xlsx"
              />
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center group-hover:border-blue-500 group-hover:bg-blue-50/50 transition-all">
                <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2 group-hover:text-blue-500" />
                <p className="text-sm text-slate-600 font-medium">Click or drag CSV/Excel files</p>
                <p className="text-xs text-slate-400 mt-1">Accepts multiple files</p>
              </div>
            </div>
            
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Uploaded Files ({files.length})</p>
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="truncate">{f.name}</span>
                  </div>
                ))}
              </div>
            )}
            {uploadLoading && <p className="text-sm text-blue-500 mt-2 animate-pulse">Uploading...</p>}
          </section>

          {/* Join Configuration */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-indigo-500" /> Join Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">File A (Left)</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm"
                  value={fileA}
                  onChange={(e) => { setFileA(e.target.value); setKeyA(''); }}
                >
                  <option value="">Select File A</option>
                  {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Join Key (File A)</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm"
                  value={keyA}
                  onChange={(e) => setKeyA(e.target.value)}
                  disabled={!fileA}
                >
                  <option value="">Select Key</option>
                  {getFileColumns(fileA).map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100"></div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">File B (Right)</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm"
                  value={fileB}
                  onChange={(e) => { setFileB(e.target.value); setKeyB(''); }}
                >
                  <option value="">Select File B</option>
                  {files.filter(f => f.id !== fileA).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Join Key (File B)</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm"
                  value={keyB}
                  onChange={(e) => setKeyB(e.target.value)}
                  disabled={!fileB}
                >
                  <option value="">Select Key</option>
                  {getFileColumns(fileB).map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Join Type</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm"
                  value={joinType}
                  onChange={(e) => setJoinType(e.target.value)}
                >
                  <option value="inner">Inner Join</option>
                  <option value="left">Left Join</option>
                  <option value="right">Right Join</option>
                  <option value="outer">Outer Join</option>
                </select>
              </div>

              <button
                onClick={handleJoin}
                disabled={joinLoading}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {joinLoading ? 'Joining...' : 'Execute Join'}
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-2">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Table className="w-5 h-5 text-blue-500" /> Preview Result
              </h2>
              {resultId && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download CSV
                </button>
              )}
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-green-600 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {!previewData ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                <Table className="w-12 h-12 mb-2 opacity-20" />
                <p>No preview available yet</p>
                <p className="text-xs">Configure and execute a join to see results</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {previewData.columns.map(col => (
                        <th key={col} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {previewData.data.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        {previewData.columns.map(col => (
                          <td key={`${i}-${col}`} className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">
                            {String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {previewData && (
              <p className="mt-4 text-xs text-slate-400 italic">
                Showing first 50 rows only. Download to see the full result.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
