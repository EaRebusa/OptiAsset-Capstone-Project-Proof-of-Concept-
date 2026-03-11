import React, { useState } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Plus, Save, X, Info } from 'lucide-react';
import axios from 'axios';
import Papa from 'papaparse';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const BulkUpload = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [autoDiagnose, setAutoDiagnose] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    
    // --- Confirmation Modal State ---
    const [previewData, setPreviewData] = useState(null); // { new_assets, updated_assets, validRows }
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // --- Manual Entry State ---
    const [manualEntry, setManualEntry] = useState({
        asset_id: '',
        model_name: '',
        device_type: 'laptop', // Default to laptop
        initial_age: '',
        repairs: 0,
        maint_score: 5,
        current_temp: '',
        current_usage: ''
    });

    // --- Validation Logic ---
    const validateRow = (row) => {
        const errors = [];
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
        const maint = parseInt(row.maint_score);
        if (isNaN(maint) || maint < 1 || maint > 10) {
            errors.push(`Invalid Maint Score: ${row.maint_score} (Must be 1-10)`);
        }
        return errors;
    };

    // --- File Handling ---
    const handleDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragActive(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragActive(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type === "text/csv") {
            setFile(droppedFile);
            setLogs([]);
        } else {
            setLogs([{ type: 'error', message: 'Invalid file type. Please upload a CSV.' }]);
        }
    };
    const handleFileInput = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setLogs([]);
        }
    };

    // --- Step 1: Parse & Preview ---
    const initiateUploadProcess = () => {
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

                data.forEach((row, index) => {
                    if (!row.asset_id || !row.model_name) {
                        skippedRows.push({ row: index + 2, reason: "Missing ID or Model" });
                        return;
                    }
                    const validationErrors = validateRow(row);
                    if (validationErrors.length > 0) {
                        skippedRows.push({ row: index + 2, reason: validationErrors.join(', ') });
                    } else {
                        validRows.push({
                            ...row,
                            initial_age: parseInt(row.initial_age),
                            repairs: parseInt(row.repairs || 0),
                            maint_score: parseInt(row.maint_score || 5),
                            current_temp: parseFloat(row.current_temp),
                            current_usage: parseFloat(row.current_usage),
                            last_updated: row.last_updated || new Date().toISOString()
                        });
                    }
                });

                if (skippedRows.length > 0) {
                     setLogs(prev => [
                         ...prev, 
                         ...skippedRows.map(s => ({ type: 'error', message: `Row ${s.row}: ${s.reason}` }))
                     ]);
                }

                if (validRows.length > 0) {
                    try {
                        // DRY RUN / PREVIEW
                        const previewRes = await axios.post(`${API_BASE_URL}/assets/bulk-upload-preview`, validRows);
                        setPreviewData({
                            ...previewRes.data,
                            validRows: validRows
                        });
                        setShowConfirmModal(true);
                    } catch (err) {
                        setLogs(prev => [...prev, { type: 'error', message: 'Server Error: Failed to generate preview.' }]);
                    }
                } else {
                    setLogs(prev => [...prev, { type: 'error', message: 'No valid rows found to process.' }]);
                }
                setUploading(false);
            },
            error: (err) => {
                setLogs([{ type: 'error', message: `CSV Parsing Error: ${err.message}` }]);
                setUploading(false);
            }
        });
    };

    // --- Step 2: Confirm & Upload ---
    const confirmUpload = async () => {
        setShowConfirmModal(false);
        setUploading(true);
        
        try {
            const response = await axios.post(`${API_BASE_URL}/assets/bulk-upload`, previewData.validRows);
            
            const backendLogs = response.data.logs || [];
            const newLogs = backendLogs.map(l => ({ type: l.status === 'skipped' ? 'warning' : 'success', message: l.message }));
            
            setLogs(prev => [...prev, ...newLogs]);
            
            if (!newLogs.some(l => l.type === 'error')) setFile(null);

            if (autoDiagnose) {
                await axios.post(`${API_BASE_URL}/assets/bulk-diagnose`);
                setLogs(prev => [...prev, { type: 'info', message: 'Auto-Diagnosis Triggered Successfully.' }]);
            }
        } catch (err) {
            setLogs(prev => [...prev, { type: 'error', message: 'Server Error: Final upload failed.' }]);
        } finally {
            setUploading(false);
            setPreviewData(null);
        }
    };

    // --- Manual Entry Handling ---
    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
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
                asset_id: '', model_name: '', device_type: 'laptop', initial_age: '', repairs: 0, maint_score: 5, current_temp: '', current_usage: ''
            });
            setShowManualEntry(false);

            if (autoDiagnose) {
                await axios.post(`${API_BASE_URL}/assets/${encodeURIComponent(payload.asset_id)}/diagnose`);
            }
        } catch (err) {
            setLogs([{ type: 'error', message: 'Failed to add asset. ID might already exist.' }]);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto relative">
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
                        
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Device Type</label>
                            <select
                                value={manualEntry.device_type}
                                onChange={e => setManualEntry({...manualEntry, device_type: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="laptop">Laptop</option>
                                <option value="desktop">Desktop</option>
                            </select>
                        </div>

                        <InputGroup label="Initial Age (Months)" type="number" value={manualEntry.initial_age} onChange={e => setManualEntry({...manualEntry, initial_age: e.target.value})} placeholder="0" required />
                        <InputGroup label="Current Temp (°C)" type="number" value={manualEntry.current_temp} onChange={e => setManualEntry({...manualEntry, current_temp: e.target.value})} placeholder="45.5" required />
                        <InputGroup label="Usage (Hrs/Week)" type="number" value={manualEntry.current_usage} onChange={e => setManualEntry({...manualEntry, current_usage: e.target.value})} placeholder="40" required />
                        <InputGroup label="Repairs Count" type="number" value={manualEntry.repairs} onChange={e => setManualEntry({...manualEntry, repairs: e.target.value})} placeholder="0" />
                        <InputGroup label="Maint Score (1-10)" type="number" value={manualEntry.maint_score} onChange={e => setManualEntry({...manualEntry, maint_score: e.target.value})} placeholder="5" required />

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
                                onClick={initiateUploadProcess}
                                disabled={uploading}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center gap-2"
                            >
                                {uploading && <RefreshCw className="animate-spin" size={16} />}
                                {uploading ? 'Processing...' : 'Review & Upload'}
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

            {/* Confirmation Modal */}
            {showConfirmModal && previewData && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100">
                            <h3 className="text-2xl font-black text-slate-800">Confirm Upload</h3>
                            <p className="text-slate-500 mt-2">Please review the summary before proceeding.</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-center">
                                    <p className="text-3xl font-black text-green-600">{previewData.new_assets}</p>
                                    <p className="text-xs font-bold text-green-800 uppercase tracking-wide">New Assets</p>
                                </div>
                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-center">
                                    <p className="text-3xl font-black text-amber-600">{previewData.updated_assets}</p>
                                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Updates</p>
                                </div>
                            </div>
                            
                            {previewData.updated_assets > 0 && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2 text-amber-600 font-bold text-sm">
                                        <Info size={16} />
                                        <span>Existing Assets Found</span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {previewData.updated_assets} existing assets will be updated with the new telemetry data from this CSV.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setShowConfirmModal(false)}
                                className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmUpload}
                                className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg shadow-slate-300"
                            >
                                Confirm & Process
                            </button>
                        </div>
                    </div>
                </div>
            )}
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