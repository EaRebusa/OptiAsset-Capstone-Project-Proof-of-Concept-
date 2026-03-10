import React, { useState } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Plus, Save, X } from 'lucide-react';
import axios from 'axios';
import Papa from 'papaparse';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const BulkUpload = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', 'partial'
    const [logs, setLogs] = useState([]);
    const [autoDiagnose, setAutoDiagnose] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);

    // --- Manual Entry State ---
    const [manualEntry, setManualEntry] = useState({
        asset_id: '',
        model_name: '',
        initial_age: '',
        repairs: 0,
        maint_score: 5,
        current_temp: '',
        current_usage: ''
    });

    // --- Validation Logic ---
    const validateRow = (row) => {
        const errors = [];

        // Type & Range Checks
        const temp = parseFloat(row.current_temp);
        if (isNaN(temp) || temp < 10 || temp > 120) {
            errors.push(`Invalid Temperature: ${row.current_temp} (Must be 10-120°C)`);
        }

        const usage = parseFloat(row.current_usage);
        if (isNaN(usage) || usage < 0 || usage > 168) {
            errors.push(`Invalid Usage: ${row.current_usage} (Must be 0-168 hrs/week)`);
        }

        const age = parseInt(row.initial_age);
        if (isNaN(age) || age < 0) {
            errors.push(`Invalid Age: ${row.initial_age}`);
        }

        return errors;
    };

    // --- File Handling (Native Implementation) ---
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragActive(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragActive(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type === "text/csv") {
            setFile(droppedFile);
            setUploadStatus(null);
            setLogs([]);
        } else {
            setLogs([{ type: 'error', message: 'Invalid file type. Please upload a CSV.' }]);
        }
    };

    const handleFileInput = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setUploadStatus(null);
            setLogs([]);
        }
    };

    const processFile = () => {
        if (!file) return;
        setUploading(true);
        setLogs([]);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                const validRows = [];
                const skippedRows = [];

                // Client-Side Validation
                data.forEach((row, index) => {
                    // Check for required headers
                    if (!row.asset_id || !row.model_name) {
                        skippedRows.push({ row: index + 2, reason: "Missing ID or Model" });
                        return;
                    }

                    const validationErrors = validateRow(row);
                    if (validationErrors.length > 0) {
                        skippedRows.push({ row: index + 2, reason: validationErrors.join(', ') });
                    } else {
                        // Prepare for backend
                        validRows.push({
                            ...row,
                            initial_age: parseInt(row.initial_age),
                            repairs: parseInt(row.repairs || 0),
                            maint_score: parseInt(row.maint_score || 5),
                            current_temp: parseFloat(row.current_temp),
                            current_usage: parseFloat(row.current_usage),
                            // If CSV has a timestamp, pass it. If not, backend handles it.
                            last_updated: row.last_updated || new Date().toISOString()
                        });
                    }
                });

                // Send valid rows to backend
                if (validRows.length > 0) {
                    try {
                        const response = await axios.post(`${API_BASE_URL}/assets/bulk-upload`, validRows);

                        // Combine backend results with client-side skips
                        const backendLogs = response.data.logs || [];
                        const allLogs = [
                            ...skippedRows.map(s => ({ type: 'error', message: `Row ${s.row}: ${s.reason}` })),
                            ...backendLogs.map(l => ({ type: l.status === 'skipped' ? 'warning' : 'success', message: l.message }))
                        ];

                        setLogs(allLogs);
                        setUploadStatus(allLogs.some(l => l.type === 'error') ? 'partial' : 'success');
                        
                        // Clear file on full success to allow new upload
                        if (!allLogs.some(l => l.type === 'error')) setFile(null);

                        if (autoDiagnose) {
                            await axios.post(`${API_BASE_URL}/assets/bulk-diagnose`);
                            setLogs(prev => [...prev, { type: 'info', message: 'Auto-Diagnosis Triggered Successfully.' }]);
                        }

                    } catch (err) {
                        console.error(err);
                        setUploadStatus('error');
                        setLogs([{ type: 'error', message: 'Server Error: Failed to process batch.' }]);
                    }
                } else {
                    setUploadStatus('error');
                    setLogs(skippedRows.map(s => ({ type: 'error', message: `Row ${s.row}: ${s.reason}` })));
                }

                setUploading(false);
            },
            error: (err) => {
                setUploadStatus('error');
                setLogs([{ type: 'error', message: `CSV Parsing Error: ${err.message}` }]);
                setUploading(false);
            }
        });
    };

    // --- Manual Entry Handling ---
    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);

        // Basic Validation
        const errors = validateRow(manualEntry);
        if (errors.length > 0) {
            setLogs(errors.map(err => ({ type: 'error', message: err })));
            setUploading(false);
            return;
        }

        try {
            const payload = {
                ...manualEntry,
                initial_age: parseInt(manualEntry.initial_age),
                repairs: parseInt(manualEntry.repairs),
                maint_score: parseInt(manualEntry.maint_score),
                current_temp: parseFloat(manualEntry.current_temp),
                current_usage: parseFloat(manualEntry.current_usage),
                last_updated: new Date().toISOString()
            };

            await axios.post(`${API_BASE_URL}/assets/`, payload);
            setLogs([{ type: 'success', message: `Asset ${manualEntry.asset_id} added successfully.` }]);
            setManualEntry({
                asset_id: '', model_name: '', initial_age: '', repairs: 0, maint_score: 5, current_temp: '', current_usage: ''
            });
            setShowManualEntry(false);

            if (autoDiagnose) {
                // Encode the ID to handle special characters (like /, ?, #) safely
                await axios.post(`${API_BASE_URL}/assets/${encodeURIComponent(payload.asset_id)}/diagnose`);
            }

        } catch (err) {
            setLogs([{ type: 'error', message: 'Failed to add asset. ID might already exist.' }]);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Ingestion Gateway</h2>
                    <p className="text-slate-500 font-medium">Bulk upload via CSV or add single assets manually.</p>
                </div>
                <button
                    onClick={() => setShowManualEntry(!showManualEntry)}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-blue-600 transition shadow-lg shadow-slate-200"
                >
                    {showManualEntry ? <X size={18} /> : <Plus size={18} />}
                    {showManualEntry ? 'Cancel Manual Entry' : 'Add Single Asset'}
                </button>
            </div>

            {/* Manual Entry Form */}
            {showManualEntry && (
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight">Single Asset Entry</h3>
                    <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <InputGroup label="Asset ID" value={manualEntry.asset_id} onChange={e => setManualEntry({...manualEntry, asset_id: e.target.value})} placeholder="e.g., OPT-001" required />
                        <InputGroup label="Model Name" value={manualEntry.model_name} onChange={e => setManualEntry({...manualEntry, model_name: e.target.value})} placeholder="e.g., Dell OptiPlex 7090" required />
                        <InputGroup label="Initial Age (Months)" type="number" value={manualEntry.initial_age} onChange={e => setManualEntry({...manualEntry, initial_age: e.target.value})} placeholder="0" required />
                        <InputGroup label="Current Temp (°C)" type="number" value={manualEntry.current_temp} onChange={e => setManualEntry({...manualEntry, current_temp: e.target.value})} placeholder="45.5" required />
                        <InputGroup label="Usage (Hrs/Week)" type="number" value={manualEntry.current_usage} onChange={e => setManualEntry({...manualEntry, current_usage: e.target.value})} placeholder="40" required />
                        <InputGroup label="Repairs Count" type="number" value={manualEntry.repairs} onChange={e => setManualEntry({...manualEntry, repairs: e.target.value})} placeholder="0" />

                        <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-4 mt-4">
                            <button type="submit" disabled={uploading} className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50">
                                {uploading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                Save Asset
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Bulk Upload Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('fileInput').click()}
                        className={`border-2 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group relative
                            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                    >
                        <input
                            type="file"
                            id="fileInput"
                            accept=".csv"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                        <div className="p-6 bg-white rounded-full shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                            <Upload className="text-blue-600" size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">
                            {isDragActive ? "Drop CSV here..." : "Drag & Drop CSV File"}
                        </h3>
                        <p className="text-slate-500 font-medium mb-6">or click to browse from your computer</p>
                        <div className="flex gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <span className="flex items-center gap-1"><FileText size={14}/> .CSV Only</span>
                            <span className="flex items-center gap-1"><AlertTriangle size={14}/> Max 5MB</span>
                        </div>
                    </div>

                    {file && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 rounded-xl">
                                    <FileText className="text-slate-600" size={24} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{file.name}</p>
                                    <p className="text-xs text-slate-500 font-bold uppercase">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button
                                onClick={processFile}
                                disabled={uploading}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center gap-2"
                            >
                                {uploading && <RefreshCw className="animate-spin" size={16} />}
                                {uploading ? 'Processing...' : 'Upload & Process'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Controls & Logs */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Processing Controls</h3>
                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                            <input
                                type="checkbox"
                                checked={autoDiagnose}
                                onChange={(e) => setAutoDiagnose(e.target.checked)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            />
                            <span className="font-bold text-slate-700 text-sm">Auto-Run Diagnostics</span>
                        </label>
                        <p className="mt-3 text-xs text-slate-400 px-2">
                            If enabled, the system will immediately calculate health scores for all new or updated assets.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm h-96 flex flex-col">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between items-center">
                            Import Log
                            {logs.length > 0 && <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">{logs.length}</span>}
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-sm">
                                    <FileText size={32} className="mb-2 opacity-20" />
                                    Waiting for input...
                                </div>
                            ) : (
                                logs.map((log, idx) => (
                                    <div key={idx} className={`p-3 rounded-xl border text-xs font-bold flex gap-3 items-start
                                        ${log.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 
                                          log.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-600' : 
                                          log.type === 'info' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                          'bg-green-50 border-green-100 text-green-600'}`}>
                                        {log.type === 'error' && <XCircle size={16} className="shrink-0 mt-0.5" />}
                                        {log.type === 'warning' && <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                                        {log.type === 'success' && <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
                                        {log.type === 'info' && <RefreshCw size={16} className="shrink-0 mt-0.5" />}
                                        <span className="leading-relaxed">{log.message}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InputGroup = ({ label, type = "text", value, onChange, placeholder, required }) => (
    <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
    </div>
);

export default BulkUpload;