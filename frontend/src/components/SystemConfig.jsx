import React, { useState, useEffect } from 'react';
import { Monitor, Laptop, Plus, Trash2, Edit2, Save, X, AlertTriangle, CheckCircle2, RefreshCw, BarChart3, Database, ShieldAlert, FileText, Clock, Activity, Calculator, Archive, RotateCcw } from 'lucide-react';
import axios from 'axios';
import Tooltip from './Tooltip';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const SystemConfig = () => {
    const [specs, setSpecs] = useState([]);
    const [stats, setStats] = useState({ total_models: 0, generic_fallbacks: 0, fleet_coverage: 0 });
    const [logs, setLogs] = useState([]);
    const [archivedAssets, setArchivedAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSpec, setEditingSpec] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // model_name to delete
    const [notification, setNotification] = useState(null); // { type: 'success' | 'warning', message: '' }

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [specsRes, statsRes, logsRes, archivedRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/specs/`),
                axios.get(`${API_BASE_URL}/specs/stats`),
                axios.get(`${API_BASE_URL}/logs/?limit=20`),
                axios.get(`${API_BASE_URL}/assets/?archived=true`)
            ]);
            setSpecs(specsRes.data);
            setStats(statsRes.data);
            setLogs(logsRes.data);
            setArchivedAssets(archivedRes.data);
        } catch (error) {
            console.error("Failed to fetch config data:", error);
            showNotification('error', "Failed to load system configuration.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleSaveSpec = async (specData) => {
        try {
            if (editingSpec) {
                // Update
                await axios.put(`${API_BASE_URL}/specs/${editingSpec.model_name}`, specData);
                showNotification('warning', "Baseline modified. Running a new Bulk Diagnosis is recommended.");
            } else {
                // Create
                await axios.post(`${API_BASE_URL}/specs/`, specData);
                showNotification('success', "New baseline added successfully.");
            }
            setShowModal(false);
            setEditingSpec(null);
            fetchData();
        } catch (error) {
            console.error("Save failed:", error);
            showNotification('error', error.response?.data?.detail || "Failed to save spec.");
        }
    };

    const handleDeleteSpec = async () => {
        if (!showDeleteConfirm) return;
        try {
            await axios.delete(`${API_BASE_URL}/specs/${showDeleteConfirm}`);
            showNotification('warning', `Baseline for ${showDeleteConfirm} removed. Assets will fallback to generic specs.`);
            setShowDeleteConfirm(null);
            fetchData();
        } catch (error) {
            console.error("Delete failed:", error);
            showNotification('error', error.response?.data?.detail || "Failed to delete spec.");
        }
    };

    const handleRestoreAsset = async (assetId) => {
        try {
            await axios.post(`${API_BASE_URL}/assets/${assetId}/restore`);
            showNotification('success', `Asset ${assetId} restored to active inventory.`);
            fetchData();
        } catch (error) {
            console.error("Restore failed:", error);
            showNotification('error', "Failed to restore asset.");
        }
    };

    const generics = specs.filter(s => s.is_generic);
    const models = specs.filter(s => !s.is_generic);

    return (
        <div className="max-w-7xl mx-auto p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-2">System Configuration</h2>
                    <p className="text-slate-500 font-medium">Manage hardware baselines and diagnostic thresholds.</p>
                </div>
                <button 
                    onClick={() => { setEditingSpec(null); setShowModal(true); }}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                >
                    <Plus size={18} /> Add New Baseline
                </button>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <StatCard 
                    icon={<Database size={24} className="text-blue-600" />} 
                    label="Total Models" 
                    value={stats.total_models} 
                    subtext="Unique hardware profiles"
                />
                <StatCard 
                    icon={<ShieldAlert size={24} className="text-amber-600" />} 
                    label="Generic Fallbacks" 
                    value={stats.generic_fallbacks} 
                    subtext="Safety Net configurations active"
                    color="amber"
                />
                <StatCard 
                    icon={<BarChart3 size={24} className="text-emerald-600" />} 
                    label="Fleet Coverage" 
                    value={`${stats.fleet_coverage}%`} 
                    subtext="Assets with specific specs"
                    color="emerald"
                />
            </div>

            {/* Notification Area */}
            {notification && (
                <div className={`mb-8 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2
                    ${notification.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 
                      notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                      'bg-green-50 border-green-200 text-green-800'}`}>
                    {notification.type === 'warning' ? <AlertTriangle size={20} /> : 
                     notification.type === 'error' ? <X size={20} /> : <CheckCircle2 size={20} />}
                    <span className="font-bold">{notification.message}</span>
                    {notification.type === 'warning' && (
                        <button className="ml-auto px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg text-xs font-black uppercase tracking-wider transition">
                            Dismiss
                        </button>
                    )}
                </div>
            )}

            {/* Generic Safety Net Section */}
            <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                        <ShieldAlert size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-wide">Generic Safety Net</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <SpecsTable 
                        specs={generics} 
                        onEdit={(spec) => { setEditingSpec(spec); setShowModal(true); }}
                        isGeneric={true}
                    />
                </div>
                <p className="mt-3 text-sm text-slate-400 px-4">
                    * These fallbacks are applied automatically when a specific model match is not found.
                </p>
            </section>

            {/* Manufacturer Specs Library */}
            <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Database size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-wide">Manufacturer Specs Library</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <SpecsTable 
                        specs={models} 
                        onEdit={(spec) => { setEditingSpec(spec); setShowModal(true); }}
                        onDelete={(model_name) => setShowDeleteConfirm(model_name)}
                    />
                </div>
            </section>

            {/* Inventory Archive Section */}
            <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                        <Archive size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-wide">Inventory Archive (History)</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-72 flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 shadow-sm">
                                <tr className="text-xs font-black text-slate-400 uppercase tracking-wider">
                                    <th className="p-6">Asset ID</th>
                                    <th className="p-6">Model Name</th>
                                    <th className="p-6">Reason for Archiving</th>
                                    <th className="p-6 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {archivedAssets.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-slate-400 italic font-medium">
                                            No archived assets found.
                                        </td>
                                    </tr>
                                ) : (
                                    archivedAssets.map((asset) => (
                                        <tr key={asset.id} className="hover:bg-slate-50/50 transition">
                                            <td className="p-6 font-bold text-slate-800">{asset.asset_id}</td>
                                            <td className="p-6 text-sm font-bold text-slate-500">{asset.model_name}</td>
                                            <td className="p-6 text-sm italic text-slate-600">"{asset.deletion_reason}"</td>
                                            <td className="p-6 text-right">
                                                <button 
                                                    onClick={() => handleRestoreAsset(asset.asset_id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition shadow-sm ml-auto"
                                                >
                                                    <RotateCcw size={14} /> Restore
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Action Logs Section */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                        <Activity size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-wide">Action Logs</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-96 flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 shadow-sm">
                                <tr className="text-xs font-black text-slate-400 uppercase tracking-wider">
                                    <th className="p-6 w-48">Timestamp</th>
                                    <th className="p-6 w-32">Action</th>
                                    <th className="p-6 w-40">Entity</th>
                                    <th className="p-6">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-slate-400 italic font-medium">
                                            No recent activity.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition">
                                            <td className="p-6 text-xs font-bold text-slate-500 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} className="text-slate-400" />
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider
                                                    ${log.action_type === 'CREATE' ? 'bg-green-100 text-green-700' :
                                                      log.action_type === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                      log.action_type === 'DELETE' || log.action_type === 'ARCHIVE' ? 'bg-red-100 text-red-700' :
                                                      log.action_type === 'RESTORE' ? 'bg-emerald-100 text-emerald-700' :
                                                      log.action_type === 'OVERRIDE' ? 'bg-purple-100 text-purple-700' :
                                                      'bg-slate-100 text-slate-700'}`}>
                                                    {log.action_type}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-400 uppercase">{log.entity_type}</span>
                                                    <span className="text-sm font-bold text-slate-800 truncate max-w-[150px]" title={log.entity_id}>
                                                        {log.entity_id}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-sm font-medium text-slate-600">
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Add/Edit Modal */}
            {showModal && (
                <SpecModal 
                    spec={editingSpec} 
                    onClose={() => setShowModal(false)} 
                    onSave={handleSaveSpec} 
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="p-4 bg-red-50 text-red-600 rounded-full mb-4">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Remove Baseline?</h3>
                            <p className="text-slate-500 font-medium">
                                Removing <span className="font-bold text-slate-800">{showDeleteConfirm}</span> will cause all associated assets to fallback to Generic specs.
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-bold uppercase tracking-wider hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteSpec}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-red-700 transition shadow-lg shadow-red-200"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon, label, value, subtext, color = "blue" }) => (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
        <div className={`p-4 rounded-2xl bg-${color}-50 border border-${color}-100`}>
            {icon}
        </div>
        <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-3xl font-black text-slate-800">{value}</p>
            <p className="text-xs font-bold text-slate-400 mt-1">{subtext}</p>
        </div>
    </div>
);

const SpecsTable = ({ specs, onEdit, onDelete, isGeneric }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left">
            <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider">
                    <th className="p-6">Device Type</th>
                    <th className="p-6">Model Name</th>
                    <th className="p-6">Temp Norm (°C)</th>
                    <th className="p-6">Usage Norm (Hrs)</th>
                    <th className="p-6">Warranty (Mos)</th>
                    <th className="p-6 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {specs.length === 0 ? (
                    <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-400 italic font-medium">
                            No specs found. Add a baseline to get started.
                        </td>
                    </tr>
                ) : (
                    specs.map((spec) => (
                        <tr key={spec.id} className="hover:bg-slate-50/50 transition group">
                            <td className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${spec.device_type === 'desktop' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {spec.device_type === 'desktop' ? <Monitor size={18} /> : <Laptop size={18} />}
                                    </div>
                                    <span className="font-bold text-slate-600 capitalize">{spec.device_type}</span>
                                </div>
                            </td>
                            <td className="p-6 font-bold text-slate-800">{spec.model_name}</td>
                            <td className="p-6 font-bold text-slate-600">{spec.temp_norm}</td>
                            <td className="p-6 font-bold text-slate-600">{spec.usage_norm}</td>
                            <td className="p-6 font-bold text-slate-600">{spec.warranty_months}</td>
                            <td className="p-6 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => onEdit(spec)}
                                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition"
                                        title="Edit Baseline"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    {!isGeneric && (
                                        <button 
                                            onClick={() => onDelete(spec.model_name)}
                                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition"
                                            title="Delete Baseline"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);

const SpecModal = ({ spec, onClose, onSave }) => {
    const isEditing = !!spec;
    const [formData, setFormData] = useState({
        model_name: spec?.model_name || '',
        device_type: spec?.device_type || 'laptop',
        temp_norm: spec?.temp_norm || '',
        usage_norm: spec?.usage_norm || '',
        warranty_months: spec?.warranty_months || ''
    });

    // Temp Calculation State
    const [showTempCalc, setShowTempCalc] = useState(false);
    const [tempRange, setTempRange] = useState({ min: '', max: '' });

    // Auto-calculate average when range changes
    useEffect(() => {
        if (tempRange.min && tempRange.max) {
            const min = parseFloat(tempRange.min);
            const max = parseFloat(tempRange.max);
            if (!isNaN(min) && !isNaN(max)) {
                const avg = (min + max) / 2;
                setFormData(prev => ({ ...prev, temp_norm: avg.toFixed(1) }));
            }
        }
    }, [tempRange]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            temp_norm: parseFloat(formData.temp_norm),
            usage_norm: parseFloat(formData.usage_norm),
            warranty_months: parseInt(formData.warranty_months)
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">
                        {isEditing ? 'Edit Baseline' : 'Add New Baseline'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X size={20} />
                    </button>
                </header>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Model Name</label>
                        <input 
                            type="text" 
                            name="model_name"
                            value={formData.model_name}
                            onChange={handleChange}
                            disabled={isEditing} // Prevent changing ID on edit
                            placeholder="e.g. Dell Latitude 5440"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Device Type</label>
                        <div className="flex gap-4">
                            <label className={`flex-1 p-3 border rounded-xl flex items-center justify-center gap-2 cursor-pointer transition
                                ${formData.device_type === 'laptop' ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500 ring-offset-2' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                <input 
                                    type="radio" 
                                    name="device_type" 
                                    value="laptop" 
                                    checked={formData.device_type === 'laptop'} 
                                    onChange={handleChange}
                                    className="hidden"
                                />
                                <Laptop size={18} />
                                <span className="font-bold text-sm">Laptop</span>
                            </label>
                            <label className={`flex-1 p-3 border rounded-xl flex items-center justify-center gap-2 cursor-pointer transition
                                ${formData.device_type === 'desktop' ? 'bg-purple-50 border-purple-200 text-purple-700 ring-2 ring-purple-500 ring-offset-2' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                <input 
                                    type="radio" 
                                    name="device_type" 
                                    value="desktop" 
                                    checked={formData.device_type === 'desktop'} 
                                    onChange={handleChange}
                                    className="hidden"
                                />
                                <Monitor size={18} />
                                <span className="font-bold text-sm">Desktop</span>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Temp Norm (°C)</label>
                                <button 
                                    type="button"
                                    onClick={() => setShowTempCalc(!showTempCalc)}
                                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                >
                                    <Calculator size={10} />
                                    {showTempCalc ? 'Manual' : 'Calc'}
                                </button>
                            </div>
                            
                            {showTempCalc ? (
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Min"
                                        value={tempRange.min}
                                        onChange={e => setTempRange({...tempRange, min: e.target.value})}
                                        className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input 
                                        type="number" 
                                        placeholder="Max"
                                        value={tempRange.max}
                                        onChange={e => setTempRange({...tempRange, max: e.target.value})}
                                        className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            ) : (
                                <input 
                                    type="number" 
                                    name="temp_norm"
                                    value={formData.temp_norm}
                                    onChange={handleChange}
                                    step="0.1"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            )}
                            {showTempCalc && formData.temp_norm && (
                                <p className="mt-1 text-[10px] text-slate-500 font-medium text-center">
                                    Avg: <span className="font-bold text-slate-800">{formData.temp_norm}°C</span>
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Usage Norm (Hrs)</label>
                            <input 
                                type="number" 
                                name="usage_norm"
                                value={formData.usage_norm}
                                onChange={handleChange}
                                step="0.1"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Warranty (Mos)</label>
                            <input 
                                type="number" 
                                name="warranty_months"
                                value={formData.warranty_months}
                                onChange={handleChange}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                        >
                            {isEditing ? 'Save Changes' : 'Create Baseline'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SystemConfig;