import React, { useState, useEffect } from 'react';
import { Monitor, Laptop, Plus, Trash2, Edit2, Save, X, AlertTriangle, CheckCircle2, RefreshCw, BarChart3, Database, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import Tooltip from './Tooltip';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const SystemConfig = () => {
    const [specs, setSpecs] = useState([]);
    const [stats, setStats] = useState({ total_models: 0, generic_fallbacks: 0, fleet_coverage: 0 });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSpec, setEditingSpec] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // model_name to delete
    const [notification, setNotification] = useState(null); // { type: 'success' | 'warning', message: '' }

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [specsRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/specs/`),
                axios.get(`${API_BASE_URL}/specs/stats`)
            ]);
            setSpecs(specsRes.data);
            setStats(statsRes.data);
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
            <section>
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
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Temp Norm (°C)</label>
                            <input 
                                type="number" 
                                name="temp_norm"
                                value={formData.temp_norm}
                                onChange={handleChange}
                                step="0.1"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
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