import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    LayoutDashboard,
    Package,
    Upload,
    Settings,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ChevronRight,
    Monitor,
    Laptop,
    Activity,
    RefreshCw,
    Search,
    XCircle
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    Tooltip
} from 'recharts';

// --- API SERVICE CONFIGURATION ---
// Matching your Uvicorn output: http://127.0.0.1:8000
const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
});

const COLORS = {
    Healthy: '#10b981',           // Green
    Warning: '#f59e0b',           // Amber
    Critical: '#ef4444',          // Red
    Unscored: '#94a3b8'           // Slate
};

// --- MAIN UI COMPONENT ---
const App = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [diagnosing, setDiagnosing] = useState(null);

    // Initial Sync
    useEffect(() => {
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/assets/');
            setAssets(response.data);
        } catch (err) {
            console.error("Connection Failed:", err);
            setError("Backend Unreachable. Ensure Uvicorn is running on 127.0.0.1:8000.");
        } finally {
            setLoading(false);
        }
    };

    const handleDiagnose = async (assetId) => {
        setDiagnosing(assetId);
        try {
            await api.post(`/assets/${assetId}/diagnose`);
            await fetchAssets(); // Refresh local state
        } catch (err) {
            console.error("Diagnostic Loop Error:", err);
        } finally {
            setDiagnosing(null);
        }
    };

    // Logic: Charts & Stats
    const stats = useMemo(() => ({
        total: assets.length,
        critical: assets.filter(a => a.health_score === 'Critical').length,
        warning: assets.filter(a => a.health_score === 'Warning').length,
        healthy: assets.filter(a => a.health_score === 'Healthy').length,
        unscored: assets.filter(a => a.health_score === 'Unscored').length
    }), [assets]);

    const pieData = [
        { name: 'Healthy', value: stats.healthy },
        { name: 'Warning', value: stats.warning },
        { name: 'Critical', value: stats.critical },
    ].filter(d => d.value > 0);

    const filteredAssets = assets.filter(a =>
        a.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.model_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
            {/* Sidebar - Based on Old UI */}
            <nav className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
                <div className="p-6 flex items-center gap-3 border-b border-slate-800">
                    <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/20">
                        <Activity className="text-white" size={24} />
                    </div>
                    <h1 className="text-xl font-black tracking-tighter uppercase">OptiAsset <span className="text-blue-500">Pro</span></h1>
                </div>

                <div className="flex-1 py-8 px-4 space-y-2">
                    <NavItem
                        icon={<LayoutDashboard size={20}/>}
                        label="Dashboard"
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                    />
                    <NavItem
                        icon={<Package size={20}/>}
                        label="Inventory"
                        active={activeTab === 'inventory'}
                        onClick={() => setActiveTab('inventory')}
                    />
                    <NavItem
                        icon={<Upload size={20}/>}
                        label="Bulk Upload"
                        active={activeTab === 'upload'}
                        onClick={() => setActiveTab('upload')}
                    />
                    <NavItem
                        icon={<Settings size={20}/>}
                        label="System Config"
                        active={activeTab === 'specs'}
                        onClick={() => setActiveTab('specs')}
                    />
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-2xl">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-inner">PO</div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">Property Officer</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Session</p>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto relative">
                {/* Top Header Bar */}
                <header className="sticky top-0 bg-slate-50/80 backdrop-blur-md px-10 py-6 flex justify-between items-center z-10 border-b border-slate-200/50">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight capitalize">{activeTab}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                {error ? 'System Offline' : 'Engine Synced'}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Find asset..."
                                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={fetchAssets}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition shadow-sm"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="mx-10 mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600">
                        <XCircle size={20} />
                        <p className="text-sm font-bold">{error}</p>
                    </div>
                )}

                <div className="p-10">
                    {activeTab === 'dashboard' ? (
                        <div className="space-y-8">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <StatCard label="Inventory" value={stats.total} icon={<Package className="text-blue-600"/>} color="blue"/>
                                <StatCard label="Critical" value={stats.critical} icon={<AlertCircle className="text-red-600"/>} color="red"/>
                                <StatCard label="Warning" value={stats.warning} icon={<AlertTriangle className="text-amber-600"/>} color="amber"/>
                                <StatCard label="Healthy" value={stats.healthy} icon={<CheckCircle2 className="text-green-600"/>} color="green"/>
                            </div>

                            {/* Visualization & Logic Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center">
                                    <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight">Fleet Health</h3>
                                    <div className="h-64 w-full">
                                        {pieData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        innerRadius={65}
                                                        outerRadius={85}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {pieData.map((entry) => (
                                                            <Cell key={entry.name} fill={COLORS[entry.name]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-slate-300 italic text-sm">No diagnostic data available</div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 w-full mt-6">
                                        {pieData.map(d => (
                                            <div key={d.name} className="flex flex-col p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                                <span className="text-[10px] font-black uppercase text-slate-400">{d.name}</span>
                                                <span className="text-xl font-black">{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">At-Risk Assets</h3>
                                        <button onClick={() => setActiveTab('inventory')} className="text-xs font-bold text-blue-600 hover:underline">View All</button>
                                    </div>
                                    <div className="space-y-4">
                                        {assets.filter(a => a.health_score === 'Critical' || a.health_score === 'Warning').slice(0, 4).map(asset => (
                                            <div key={asset.id} className="group flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl ${asset.health_score === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                                        {asset.model_name.includes('OptiPlex') ? <Monitor size={20}/> : <Laptop size={20}/>}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-800 tracking-tight">{asset.asset_id}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{asset.model_name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-xs font-black text-slate-400 uppercase">Age</p>
                                                        <p className="text-sm font-bold">{asset.current_age} months</p>
                                                    </div>
                                                    <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                        {assets.filter(a => a.health_score === 'Critical' || a.health_score === 'Warning').length === 0 && (
                                            <div className="py-20 text-center text-slate-300 italic">No assets currently flagged for review.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Inventory View */
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
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
                                {filteredAssets.map(asset => (
                                    <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
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
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(asset.health_score)}`}>
                          {asset.health_score}
                        </span>
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
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

// --- HELPER COMPONENTS ---

const NavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-widest ${
            active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-x-1' : 'text-slate-500 hover:bg-slate-800 hover:text-white'
        }`}
    >
        {icon} {label}
    </button>
);

const StatCard = ({ label, value, icon, color }) => {
    const colorMap = {
        blue: 'bg-blue-50 border-blue-100',
        red: 'bg-red-50 border-red-100',
        amber: 'bg-amber-50 border-amber-100',
        green: 'bg-green-50 border-green-100'
    };

    return (
        <div className={`bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-1`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-4 rounded-2xl ${colorMap[color]}`}>{icon}</div>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
            <p className="text-4xl font-black text-slate-800 leading-none tracking-tighter">{value}</p>
        </div>
    );
};

export default App;