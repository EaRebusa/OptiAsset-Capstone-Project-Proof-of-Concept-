import React from 'react';
import { Monitor, Laptop } from 'lucide-react';

const Inventory = ({ filteredAssets, handleDiagnose, diagnosing, getStatusColor, onAssetClick }) => {
    return (
        <div className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Active Inventory</h3>
                <span className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-black uppercase tracking-widest">{filteredAssets.length} Units</span>
            </div>
            <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100">
                <tr>
                    <th className="px-8 py-5">Device Identity</th>
                    <th className="px-8 py-5">Life Cycle</th>
                    <th className="px-8 py-5">Telemetry</th>
                    <th className="px-8 py-5">Health Status</th>
                    <th className="px-8 py-5 text-right">Action</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredAssets.map(asset => {
                    const effectiveScore = asset.override_score || asset.health_score;
                    const isOverridden = !!asset.override_score;

                    return (
                        <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-6 cursor-pointer" onClick={() => onAssetClick(asset)}>
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                                        {asset.model_name.includes('OptiPlex') ? <Monitor size={20}/> : <Laptop size={20}/>}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-800 text-lg leading-none">{asset.asset_id}</p>
                                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-tighter">{asset.model_name}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-slate-700">{asset.current_age}m</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Effective Age</span>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="flex gap-4 text-xs font-mono font-bold">
                                    <span className={asset.current_temp > 65 ? 'text-red-500' : 'text-slate-500'}>{asset.current_temp}°C</span>
                                    <span className="text-slate-500">{asset.current_usage}h/w</span>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="flex flex-col items-start gap-1">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(effectiveScore)}`}>
                                      {effectiveScore}
                                    </span>
                                    {isOverridden && (
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                            (Manual)
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                                <button
                                    onClick={() => handleDiagnose(asset.asset_id)}
                                    disabled={diagnosing === asset.asset_id}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50 shadow-lg shadow-slate-200 active:scale-95"
                                >
                                    {diagnosing === asset.asset_id ? 'Analyzing...' : 'Diagnose'}
                                </button>
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
};

export default Inventory;