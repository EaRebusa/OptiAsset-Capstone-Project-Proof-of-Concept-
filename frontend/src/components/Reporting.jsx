import React, { useState } from 'react';
import axios from 'axios';
import { Download, FileText, BarChart2, PieChart as PieIcon, Activity, Calendar } from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const Reporting = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleDownloadReport = async (reportType) => {
        setLoading(true);
        setError(null);
        try {
            let url = '';
            let filename = '';

            if (reportType === 'monthly') {
                url = `${API_BASE_URL}/reports/monthly-summary`;
                filename = `OptiAsset_Monthly_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
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
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-6">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            <FileText size={24} />
                        </div>
                        <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            Management
                        </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Monthly Health Summary</h3>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                        aggregated report containing health distribution counts, average asset age by device type, and total maintenance repairs logged.
                        Ideal for high-level management updates.
                    </p>
                    <button 
                        onClick={() => handleDownloadReport('monthly')}
                        disabled={loading}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Activity className="animate-spin" size={16}/> : <Download size={16} />}
                        Download Monthly Report (CSV)
                    </button>
                </div>

                {/* Raw Data Export Card */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-6">
                        <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
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

            {/* Visual Charts Preview Section (Future Implementation Placeholder or Active if API ready) */}
            <div className="mt-12">
                <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
                    <PieIcon size={18} className="text-slate-400"/> Visual Reports Preview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 pointer-events-none grayscale">
                     {/* 
                        Note: In a real implementation with the chart endpoints, 
                        we would fetch the base64 images here and display them.
                        For now, we just show placeholders to indicate capability.
                     */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl h-64 flex items-center justify-center relative overflow-hidden">
                        <p className="text-slate-400 font-bold text-sm z-10">Health Distribution Chart</p>
                        <div className="absolute inset-0 bg-slate-100/50 flex items-center justify-center">
                            <span className="text-[10px] uppercase font-black text-slate-300 tracking-widest bg-white px-3 py-1 rounded-full shadow-sm">Coming Soon</span>
                        </div>
                    </div>
                     <div className="bg-slate-50 border border-slate-200 rounded-2xl h-64 flex items-center justify-center relative overflow-hidden">
                        <p className="text-slate-400 font-bold text-sm z-10">Average Age by Device Type</p>
                         <div className="absolute inset-0 bg-slate-100/50 flex items-center justify-center">
                            <span className="text-[10px] uppercase font-black text-slate-300 tracking-widest bg-white px-3 py-1 rounded-full shadow-sm">Coming Soon</span>
                        </div>
                    </div>
                </div>
                <p className="text-center text-xs text-slate-400 mt-4 font-medium italic">
                    Live chart previews will be enabled in the next update. Use CSV exports for current reporting needs.
                </p>
            </div>
        </div>
    );
};

export default Reporting;