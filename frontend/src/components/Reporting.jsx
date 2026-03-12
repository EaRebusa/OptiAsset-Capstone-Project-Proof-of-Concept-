import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, FileText, BarChart2, PieChart as PieIcon, Activity, Calendar, ArrowRight } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const COLORS = {
    Healthy: '#10b981',
    Warning: '#f59e0b',
    Critical: '#ef4444',
    Unscored: '#94a3b8'
};

const Reporting = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [healthData, setHealthData] = useState([]);
    const [ageData, setAgeData] = useState([]);
    const [chartsLoading, setChartsLoading] = useState(true);

    useEffect(() => {
        const fetchCharts = async () => {
            try {
                const [healthRes, ageRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/reports/charts/health-distribution`),
                    axios.get(`${API_BASE_URL}/reports/charts/age-distribution`)
                ]);

                // Transform data for charts
                if (Array.isArray(healthRes.data)) {
                    setHealthData(healthRes.data.filter(item => item.value > 0));
                }
                if (Array.isArray(ageRes.data)) {
                    setAgeData(ageRes.data.filter(item => item.value > 0));
                }
            } catch (err) {
                console.error("Failed to load charts:", err);
                // Non-critical, just don't show them
            } finally {
                setChartsLoading(false);
            }
        };

        fetchCharts();
    }, []);

    const handleDownloadReport = async (reportType) => {
        setLoading(true);
        setError(null);
        try {
            let url = '';
            let filename = '';

            if (reportType === 'monthly') {
                url = `${API_BASE_URL}/reports/monthly-summary`;
                filename = `OptiAsset_Monthly_Report_${new Date().toISOString().slice(0, 10)}.pdf`; // Changed extension to PDF
            } else if (reportType === 'export_assets') {
                url = `${API_BASE_URL}/assets/export`;
                filename = `OptiAsset_Fleet_Export_${new Date().toISOString().slice(0, 10)}.csv`;
            }

            if (!url) return;

            const response = await axios.get(url, {
                responseType: 'blob', // Important for file downloads
            });

            // Create a blob link to download
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Monthly Summary Card */}
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

                {/* Raw Data Export Card */}
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
                        Best for custom analysis in Excel or BI tools.
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
            </div>

            {/* Visual Charts Preview Section */}
            <div className="mt-12">
                <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
                    <PieIcon size={18} className="text-slate-400"/> Generated Visuals
                </h3>
                
                {chartsLoading ? (
                    <div className="flex justify-center items-center h-48 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                        <Activity className="animate-spin text-slate-400 mr-2" />
                        <span className="text-sm font-bold text-slate-400">Generating charts...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center h-80">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Health Distribution</h4>
                            {healthData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={healthData}
                                        margin={{
                                            top: 5,
                                            right: 30,
                                            left: 20,
                                            bottom: 5,
                                        }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                        <YAxis axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            cursor={{fill: 'transparent'}}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                                            {healthData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#cbd5e1'} />
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
                        
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center h-80">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Average Age by Device (Months)</h4>
                            {ageData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={ageData}
                                        layout="vertical"
                                        margin={{
                                            top: 5,
                                            right: 30,
                                            left: 20,
                                            bottom: 5,
                                        }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            cursor={{fill: 'transparent'}}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 text-xs italic">
                                    No Data Available
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                <p className="text-center text-xs text-slate-400 mt-6 font-medium">
                    Interactive charts are generated in real-time based on current fleet data.
                </p>
            </div>
        </div>
    );
};

export default Reporting;