import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Download, FileText, BarChart2, PieChart as PieIcon, Activity, Clock } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Sector
} from 'recharts';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const COLORS = {
    Healthy: '#10b981',
    Warning: '#f59e0b',
    Critical: '#ef4444',
    Unscored: '#94a3b8'
};

const FIN_COLORS = {
    Replacement: '#ef4444', // Red
    Maintenance: '#f59e0b'  // Amber
};

// --- Custom Pie Chart Renderers ---
const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', filter: 'drop-shadow(0px 8px 16px rgba(0,0,0,0.2))' }}
            />
        </g>
    );
};

const Reporting = ({ assets = [], specs = [], systemSettings = {} }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // States for chart hover animations
    const [activeFinIndex, setActiveFinIndex] = useState(null);
    const [activeHealthIndex, setActiveHealthIndex] = useState(null);
    const [activeAgeIndex, setActiveAgeIndex] = useState(null);

    // --- Compute Data for Reporting Charts Locally ---
    const { healthData, ageData, financialData } = useMemo(() => {
        const healthCounts = { Healthy: 0, Warning: 0, Critical: 0, Unscored: 0 };
        const ageAcc = {};
        const finRisk = { Replacement: 0, Maintenance: 0 };

        const specPriceMap = {};
        specs.forEach(s => { specPriceMap[s.model_name] = s.replacement_cost || 0; });
        
        const warnMult = systemSettings?.warning_multiplier ?? 0.10;
        const critMult = systemSettings?.critical_multiplier ?? 1.0;
        const fallLap = systemSettings?.fallback_laptop_cost ?? 30000;
        const fallDesk = systemSettings?.fallback_desktop_cost ?? 25000;

        assets.forEach(asset => {
            const score = asset.override_score || asset.health_score;
            if (healthCounts[score] !== undefined) healthCounts[score]++;

            const dtype = asset.device_type || 'Unknown';
            if (!ageAcc[dtype]) ageAcc[dtype] = [];
            ageAcc[dtype].push(asset.current_age || 0);

            let cost = specPriceMap[asset.model_name];
            if (!cost) {
                if (dtype === 'laptop') cost = fallLap;
                else if (dtype === 'desktop') cost = fallDesk;
                else cost = 0;
            }

            if (score === 'Critical') finRisk.Replacement += (cost * critMult);
            else if (score === 'Warning') finRisk.Maintenance += (cost * warnMult);
        });

        const hData = Object.keys(healthCounts)
            .map(k => ({ name: k, value: healthCounts[k] }))
            .filter(d => d.value > 0);

        const aData = Object.keys(ageAcc)
            .map(k => ({ name: k, value: ageAcc[k].length > 0 ? sum(ageAcc[k])/ageAcc[k].length : 0 }))
            .filter(d => d.value > 0)
            .map(d => ({...d, value: parseFloat(d.value.toFixed(1))}));

        const fData = Object.keys(finRisk)
            .map(k => ({ name: k, value: finRisk[k] }))
            .filter(d => d.value > 0);

        return { healthData: hData, ageData: aData, financialData: fData };
    }, [assets, specs, systemSettings]);

    function sum(arr) { return arr.reduce((a, b) => a + b, 0); }


    const handleDownloadReport = async (reportType) => {
        setLoading(true);
        setError(null);
        try {
            let url = '';
            let filename = '';

            if (reportType === 'monthly') {
                url = `${API_BASE_URL}/reports/monthly-summary`;
                filename = `OptiAsset_Monthly_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
            } else if (reportType === 'export_assets') {
                url = `${API_BASE_URL}/assets/export`;
                filename = `OptiAsset_Fleet_Export_${new Date().toISOString().slice(0, 10)}.csv`;
            } else if (reportType === 'export_logs') {
                url = `${API_BASE_URL}/reports/export-logs`;
                filename = `OptiAsset_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
            }

            if (!url) return;

            const response = await axios.get(url, { responseType: 'blob' });
            const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = urlBlob;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Report Download Failed:", err);
            setError("Failed to download report. Please check server connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Reporting & Analytics</h2>
                    <p className="text-sm text-slate-500 mt-1">Generate insights and export fleet data.</p>
                </div>
            </header>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold flex items-center gap-2">
                    <Activity size={16} />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-start justify-between mb-6">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <FileText size={24} />
                        </div>
                        <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            Management
                        </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Monthly Health Summary</h3>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                        Full PDF report containing executive summary, health distribution charts, aging analysis, and maintenance statistics.
                    </p>
                    <button 
                        onClick={() => handleDownloadReport('monthly')}
                        disabled={loading}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Activity className="animate-spin" size={16}/> : <Download size={16} />}
                        Download Monthly Report (PDF)
                    </button>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-start justify-between mb-6">
                        <div className="p-3 bg-green-50 text-green-600 rounded-2xl group-hover:bg-green-600 group-hover:text-white transition-colors">
                            <BarChart2 size={24} />
                        </div>
                        <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            Data Analyst
                        </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Full Fleet Data Export</h3>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                        Complete extraction of all active asset records, including raw telemetry (temperature, usage), health scores, and maintenance logs.
                    </p>
                    <button 
                        onClick={() => handleDownloadReport('export_assets')}
                        disabled={loading}
                        className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Activity className="animate-spin" size={16}/> : <Download size={16} />}
                        Export Raw Data (CSV)
                    </button>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-start justify-between mb-6">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <Clock size={24} />
                        </div>
                        <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            Data Scientist
                        </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Audit Trail & Event Logs</h3>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                        Chronological history of all system events, manual overrides, and archiving reasons. Crucial for compliance audits and ML training.
                    </p>
                    <button 
                        onClick={() => handleDownloadReport('export_logs')}
                        disabled={loading}
                        className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-purple-300 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Activity className="animate-spin" size={16}/> : <Download size={16} />}
                        Export Audit Trail (CSV)
                    </button>
                </div>
            </div>

            {/* Visual Charts Preview Section */}
            <div className="mt-12">
                <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
                    <PieIcon size={18} className="text-slate-400"/> Live Report Visuals
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Financial Risk Pie Chart */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center h-80">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Financial Risk (PHP)</h4>
                        {financialData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={financialData}
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        activeIndex={activeFinIndex}
                                        activeShape={renderActiveShape}
                                        onMouseEnter={(_, index) => setActiveFinIndex(index)}
                                        onMouseLeave={() => setActiveFinIndex(null)}
                                        animationBegin={0}
                                        animationDuration={800}
                                    >
                                        {financialData.map((entry, index) => (
                                            <Cell 
                                                key={entry.name} 
                                                fill={FIN_COLORS[entry.name]} 
                                                cursor="pointer" 
                                                className="outline-none" 
                                                style={{ outline: 'none', transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)', opacity: activeFinIndex !== null && activeFinIndex !== index ? 0.6 : 1 }} 
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `₱${value.toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 text-xs italic">
                                No Risk Detected
                            </div>
                        )}
                        <div className="flex justify-center gap-4 w-full mt-4">
                            {financialData.map((d, index) => (
                                <div 
                                    key={d.name} 
                                    className="flex items-center gap-2 cursor-pointer"
                                    onMouseEnter={() => setActiveFinIndex(index)}
                                    onMouseLeave={() => setActiveFinIndex(null)}
                                >
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FIN_COLORS[d.name] }}></div>
                                    <span className="text-xs font-bold text-slate-500 uppercase">{d.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Health Distribution Bar Chart */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center h-80">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Health Distribution</h4>
                        {healthData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={healthData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{fill: 'transparent'}} />
                                    <Bar 
                                        dataKey="value" 
                                        radius={[4, 4, 0, 0]} 
                                        barSize={40}
                                        onMouseEnter={(_, index) => setActiveHealthIndex(index)}
                                        onMouseLeave={() => setActiveHealthIndex(null)}
                                        animationBegin={0}
                                        animationDuration={800}
                                    >
                                        {healthData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                cursor="pointer" 
                                                fill={COLORS[entry.name] || '#cbd5e1'} 
                                                style={{ 
                                                    outline: 'none', 
                                                    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    opacity: activeHealthIndex !== null && activeHealthIndex !== index ? 0.6 : 1,
                                                    filter: activeHealthIndex === index ? 'drop-shadow(0px 8px 16px rgba(0,0,0,0.2))' : 'none'
                                                }}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 text-xs italic">
                                No Data Available
                            </div>
                        )}
                    </div>
                    
                    {/* Age Distribution Bar Chart */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center h-80">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Avg Age (Months)</h4>
                        {ageData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ageData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{fill: 'transparent'}} />
                                    <Bar 
                                        dataKey="value" 
                                        fill="#3b82f6" 
                                        radius={[0, 4, 4, 0]} 
                                        barSize={20}
                                        onMouseEnter={(_, index) => setActiveAgeIndex(index)}
                                        onMouseLeave={() => setActiveAgeIndex(null)}
                                        animationBegin={0}
                                        animationDuration={800}
                                    >
                                        {ageData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                cursor="pointer" 
                                                fill="#3b82f6" 
                                                style={{ 
                                                    outline: 'none', 
                                                    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    opacity: activeAgeIndex !== null && activeAgeIndex !== index ? 0.6 : 1,
                                                    filter: activeAgeIndex === index ? 'drop-shadow(0px 8px 16px rgba(0,0,0,0.2))' : 'none'
                                                }}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 text-xs italic">
                                No Data Available
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reporting;