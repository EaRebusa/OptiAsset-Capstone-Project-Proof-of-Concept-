import React, { useState, useMemo } from 'react';
import { Monitor, Laptop, Filter, AlertTriangle, RefreshCw, Trash2, Archive, ArrowDownUp, Thermometer, Calendar } from 'lucide-react';
import Tooltip from './Tooltip';

const formatAge = (months) => {
    if (months === null || months === undefined) return 'N/A';
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return `${remainingMonths}m`;
    if (remainingMonths === 0) return `${years}y`;
    return `${years}y ${remainingMonths}m`;
};

const Inventory = ({ filteredAssets, handleDiagnose, diagnosing, getStatusColor, onAssetClick, loading, onDelete, onBatchDelete }) => {
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterDeviceType, setFilterDeviceType] = useState('All');
    const [sortBy, setSortBy] = useState('health');
    const [filterAge, setFilterAge] = useState(false);
    const [selectedAssets, setSelectedAssets] = useState([]);

    const getEffectiveScore = (asset) => asset.override_score || asset.health_score;

    const displayedAssets = useMemo(() => {
        let assets = filteredAssets.filter(asset => {
            const matchesStatus = filterStatus === 'All' 
                ? true 
                : filterStatus === 'Overridden' 
                    ? !!asset.override_score 
                    : getEffectiveScore(asset) === filterStatus;
            
            const matchesAge = filterAge ? asset.current_age > 36 : true;

            const isDesktop = asset.device_type === 'desktop' || asset.model_name.toLowerCase().includes('desktop') || asset.model_name.includes('OptiPlex') || asset.model_name.includes('ProDesk');
            const deviceType = isDesktop ? 'Desktop' : 'Laptop';
            const matchesDeviceType = filterDeviceType === 'All' || deviceType === filterDeviceType;

            return matchesStatus && matchesAge && matchesDeviceType;
        });

        // Sorting logic
        switch (sortBy) {
            case 'age_asc':
                 // User selected "Age (Oldest)", so we want largest age first (Descending numeric)
                assets.sort((a, b) => (b.current_age || 0) - (a.current_age || 0));
                break;
            case 'age_desc':
                // User selected "Age (Newest)", so we want smallest age first (Ascending numeric)
                assets.sort((a, b) => (a.current_age || 0) - (b.current_age || 0));
                break;
            case 'temp_asc':
                assets.sort((a, b) => (a.current_temp || 0) - (b.current_temp || 0));
                break;
            case 'temp_desc':
                assets.sort((a, b) => (b.current_temp || 0) - (a.current_temp || 0));
                break;
            default:
                // Default sort by health or other criteria can be handled here
                break;
        }

        return assets;
    }, [filteredAssets, filterStatus, filterAge, filterDeviceType, sortBy]);

    const handleSelect = (assetId) => {
        setSelectedAssets(prev => 
            prev.includes(assetId) 
                ? prev.filter(id => id !== assetId) 
                : [...prev, assetId]
        );
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedAssets(displayedAssets.map(a => a.asset_id));
        } else {
            setSelectedAssets([]);
        }
    };

    const handleDelete = (assetId) => {
        const reason = window.prompt(`Archive asset ${assetId}? Please enter a reason:`, "Manual Deletion");
        if (reason !== null) {
            onDelete(assetId, reason);
        }
    };

    const handleBatchDelete = () => {
        const reason = window.prompt(`Archive ${selectedAssets.length} assets? Please enter a reason:`, "Batch Manual Deletion");
        if (reason !== null) {
            onBatchDelete(selectedAssets, reason);
            setSelectedAssets([]);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-4xl border border-slate-200 shadow-sm h-96 flex flex-col items-center justify-center">
                <RefreshCw className="animate-spin text-blue-600 mb-4" size={32} />
                <p className="text-slate-500 font-bold text-sm">Loading Inventory...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Active Inventory</h3>
                    <span className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-black uppercase tracking-widest">{displayedAssets.length} Units</span>
                    {selectedAssets.length > 0 && (
                        <button 
                            onClick={handleBatchDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-600 transition shadow-lg shadow-red-200"
                        >
                            <Archive size={14} /> Archive ({selectedAssets.length})
                        </button>
                    )}
                </div>
                
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                        <Filter size={14} className="text-slate-400" />
                        <select 
                            value={filterStatus} 
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-600 outline-none uppercase tracking-wider cursor-pointer"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Critical">Critical Only</option>
                            <option value="Warning">Warning Only</option>
                            <option value="Healthy">Healthy Only</option>
                            <option value="Overridden">Manual Overrides</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                        <Laptop size={14} className="text-slate-400" />
                        <select 
                            value={filterDeviceType} 
                            onChange={(e) => setFilterDeviceType(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-600 outline-none uppercase tracking-wider cursor-pointer"
                        >
                            <option value="All">All Devices</option>
                            <option value="Laptop">Laptops Only</option>
                            <option value="Desktop">Desktops Only</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                        <ArrowDownUp size={14} className="text-slate-400" />
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-600 outline-none uppercase tracking-wider cursor-pointer"
                        >
                            <option value="health">Sort by Health</option>
                            <option value="age_desc">Age (Newest)</option>
                            <option value="age_asc">Age (Oldest)</option>
                            <option value="temp_desc">Temp (Hottest)</option>
                            <option value="temp_asc">Temp (Coldest)</option>
                        </select>
                    </div>

                    <button 
                        onClick={() => setFilterAge(!filterAge)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${filterAge ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        <AlertTriangle size={14} /> Out of Warranty (>3y)
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100">
                    <tr>
                        <th className="px-8 py-5 w-12">
                            <input 
                                type="checkbox"
                                onChange={handleSelectAll}
                                checked={selectedAssets.length > 0 && selectedAssets.length === displayedAssets.length}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </th>
                        <th className="px-8 py-5">Device Identity</th>
                        <th className="px-8 py-5">Life Cycle</th>
                        <th className="px-8 py-5">Telemetry</th>
                        <th className="px-8 py-5">Health Status</th>
                        <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {displayedAssets.map(asset => {
                        const effectiveScore = getEffectiveScore(asset);
                        const isOverridden = !!asset.override_score;
                        const isOutOfWarranty = asset.current_age > 36;
                        const tempRising = asset.current_temp > 75; 
                        
                        const isDesktop = asset.device_type === 'desktop' || 
                                          asset.model_name.toLowerCase().includes('desktop') || 
                                          asset.model_name.includes('OptiPlex') || 
                                          asset.model_name.includes('ProDesk');

                        return (
                            <tr key={asset.id} className={`hover:bg-slate-50/50 transition-colors group ${selectedAssets.includes(asset.asset_id) ? 'bg-blue-50' : ''}`}>
                                <td className="px-8 py-6">
                                    <input 
                                        type="checkbox"
                                        checked={selectedAssets.includes(asset.asset_id)}
                                        onChange={() => handleSelect(asset.asset_id)}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    />
                                </td>
                                <td className="px-8 py-6 cursor-pointer" onClick={() => onAssetClick(asset)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl transition-all duration-300 ${isDesktop ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                            {isDesktop ? <Monitor size={20}/> : <Laptop size={20}/>}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-lg leading-none">{asset.asset_id}</p>
                                            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-tighter">{asset.model_name}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex flex-col">
                                        <Tooltip text={`${asset.current_age} months`}>
                                            <span className={`text-sm font-black cursor-default ${isOutOfWarranty ? 'text-amber-600' : 'text-slate-700'}`}>
                                                {formatAge(asset.current_age)}
                                                {isOutOfWarranty && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">Exp</span>}
                                            </span>
                                        </Tooltip>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Effective Age</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex gap-4 text-xs font-mono font-bold">
                                        <div className="flex items-center gap-1">
                                            <span className={asset.current_temp > 65 ? 'text-red-500' : 'text-slate-500'}>{asset.current_temp}°C</span>
                                            {tempRising && <span className="text-red-500 text-[10px] animate-pulse">▲</span>}
                                        </div>
                                        <span className="text-slate-500">{asset.current_usage}h/w</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex flex-col items-start gap-1">
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(effectiveScore)}`}>
                                          {effectiveScore}
                                        </span>
                                        {isOverridden && (
                                            <Tooltip text={
                                                <div className="text-left">
                                                    <p className="font-bold mb-1">Manual Override</p>
                                                    <p className="italic text-slate-300">"{asset.override_reason}"</p>
                                                </div>
                                            }>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 cursor-help border-b border-dotted border-slate-400">
                                                    (Manual)
                                                </span>
                                            </Tooltip>
                                        )}
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end items-center gap-2">
                                        <button
                                            onClick={() => handleDiagnose(asset.asset_id)}
                                            disabled={diagnosing === asset.asset_id}
                                            className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50 shadow-lg shadow-slate-200 active:scale-95"
                                        >
                                            {diagnosing === asset.asset_id ? 'Analyzing...' : 'Diagnose'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(asset.asset_id)}
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                            title="Archive Asset"
                                        >
                                            <Archive size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {displayedAssets.length === 0 && (
                        <tr>
                            <td colSpan="6" className="px-8 py-12 text-center text-slate-400 italic">
                                No assets match the current filters.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Inventory;