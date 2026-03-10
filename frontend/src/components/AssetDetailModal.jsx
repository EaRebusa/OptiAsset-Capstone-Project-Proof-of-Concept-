import React, { useState, useEffect, useMemo } from 'react';
import { X, Monitor, Laptop, Edit2, Save, AlertCircle } from 'lucide-react';
import Tooltip from './Tooltip';

const getStatusColor = (healthScore) => {
    switch (healthScore) {
        case 'Healthy':
            return 'border-green-200 bg-green-50 text-green-600';
        case 'Warning':
            return 'border-amber-200 bg-amber-50 text-amber-600';
        case 'Critical':
            return 'border-red-200 bg-red-50 text-red-600';
        default:
            return 'border-slate-200 bg-slate-50 text-slate-500';
    }
};

const formatAge = (months) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return `${remainingMonths}m`;
    if (remainingMonths === 0) return `${years}y`;
    return `${years}y ${remainingMonths}m`;
};

const AssetDetailModal = ({ asset, onClose, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        initial_age: 0,
        repairs: 0,
        maint_score: 0,
        current_temp: 0,
        current_usage: 0,
        override_score: '',
        override_reason: ''
    });

    const calculatedCurrentAge = useMemo(() => {
        if (!asset) return 0;
        const now = new Date();
        const createdAt = new Date(asset.created_at);
        const monthsPassed = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());
        return parseInt(formData.initial_age || 0) + Math.max(0, monthsPassed);
    }, [asset, formData.initial_age]);


    useEffect(() => {
        if (asset) {
            setFormData({
                initial_age: asset.initial_age,
                repairs: asset.repairs,
                maint_score: asset.maint_score,
                current_temp: asset.current_temp,
                current_usage: asset.current_usage,
                override_score: asset.override_score || '',
                override_reason: asset.override_reason || ''
            });
            setIsEditing(false);
        }
    }, [asset]);

    if (!asset) return null;

    const effectiveScore = asset.override_score || asset.health_score;
    const isOverridden = !!asset.override_score;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = () => {
        const payload = {
            initial_age: parseInt(formData.initial_age),
            repairs: parseInt(formData.repairs),
            maint_score: parseInt(formData.maint_score),
            current_temp: parseFloat(formData.current_temp),
            current_usage: parseFloat(formData.current_usage),
            override_score: formData.override_score || null,
            override_reason: formData.override_reason || null
        };
        onSave(asset.asset_id, payload);
        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <header className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            {asset.model_name.includes('OptiPlex') ? <Monitor size={24}/> : <Laptop size={24}/>}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{asset.asset_id}</h2>
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">{asset.model_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition shadow-lg shadow-slate-200">
                                <Edit2 size={14} /> Edit / Override
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition">
                                    Cancel
                                </button>
                                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                                    <Save size={14} /> Save Changes
                                </button>
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Left Column: Data Correction */}
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                Asset Details {isEditing && <span className="text-blue-600 text-[10px]">(Editable)</span>}
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <DetailItem 
                                    label="Current Age (for ML)" 
                                    value={formatAge(calculatedCurrentAge)} 
                                    tooltipText={`${calculatedCurrentAge} months`}
                                />
                                <EditableField
                                    label="Initial Age (Baseline)"
                                    name="initial_age"
                                    value={formData.initial_age}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    type="number"
                                    displayValue={formatAge(formData.initial_age)}
                                    tooltipText={`${formData.initial_age} months`}
                                />
                                <EditableField
                                    label="Repairs Count"
                                    name="repairs"
                                    value={formData.repairs}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    type="number"
                                />
                                <EditableField
                                    label="Maint. Score (0-10)"
                                    name="maint_score"
                                    value={formData.maint_score}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    type="number"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                Live Telemetry {isEditing && <span className="text-blue-600 text-[10px]">(Editable)</span>}
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <EditableField
                                    label="Temperature (°C)"
                                    name="current_temp"
                                    value={formData.current_temp}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    type="number"
                                    highlight={formData.current_temp > 65}
                                />
                                <EditableField
                                    label="Usage (hours/week)"
                                    name="current_usage"
                                    value={formData.current_usage}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    type="number"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Health & Override */}
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Health Status</h3>
                            <div className="p-6 bg-slate-50/70 border border-slate-100 rounded-2xl mb-4">
                                <p className="text-sm font-bold text-slate-500">ML System Score</p>
                                <p className={`text-3xl font-black ${getStatusColor(asset.health_score).split(' ')[2]}`}>{asset.health_score}</p>
                            </div>

                            <div className={`p-6 border rounded-2xl transition-all ${isEditing ? 'bg-white border-blue-200 shadow-md' : 'bg-slate-50/70 border-slate-100'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-sm font-bold text-slate-500">Effective Score</p>
                                        {!isEditing ? (
                                            <p className={`text-3xl font-black ${getStatusColor(effectiveScore).split(' ')[2]}`}>{effectiveScore}</p>
                                        ) : (
                                            <select
                                                name="override_score"
                                                value={formData.override_score}
                                                onChange={handleInputChange}
                                                className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="">Use System Score</option>
                                                <option value="Healthy">Healthy</option>
                                                <option value="Warning">Warning</option>
                                                <option value="Critical">Critical</option>
                                            </select>
                                        )}
                                    </div>
                                    {isOverridden && !isEditing && (
                                        <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">Manual Override</span>
                                    )}
                                </div>

                                {(isOverridden || isEditing) && (
                                    <div className="mt-4 pt-4 border-t border-slate-200/50">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Override Reason</p>
                                        {!isEditing ? (
                                            <p className="text-sm text-slate-700 italic">"{asset.override_reason || 'No reason provided'}"</p>
                                        ) : (
                                            <textarea
                                                name="override_reason"
                                                value={formData.override_reason}
                                                onChange={handleInputChange}
                                                placeholder="Why are you overriding this score? (Required)"
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24"
                                            />
                                        )}
                                    </div>
                                )}
                                {isEditing && !formData.override_score && (
                                    <div className="mt-4 flex items-center gap-2 text-slate-400 text-xs">
                                        <AlertCircle size={14} />
                                        <span>Select a score above to enable override.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DetailItem = ({ label, value, tooltipText }) => (
    <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <Tooltip text={tooltipText}>
            <p className="text-lg font-black text-slate-800 cursor-default">{value}</p>
        </Tooltip>
    </div>
);


const EditableField = ({ label, name, value, isEditing, onChange, type = "text", highlight = false, displayValue, tooltipText }) => (
    <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        {isEditing ? (
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
        ) : (
            <Tooltip text={tooltipText}>
                <p className={`text-lg font-black ${highlight ? 'text-red-500' : 'text-slate-800'} cursor-default`}>{displayValue || value}</p>
            </Tooltip>
        )}
    </div>
);

export default AssetDetailModal;