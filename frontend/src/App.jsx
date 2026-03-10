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
import BulkUpload from './components/BulkUpload';
import SystemConfig from './components/SystemConfig';
import Inventory from './components/Inventory';

// --- API SERVICE CONFIGURATION ---
const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
});

const COLORS = {
    Healthy: '#10b981',
    Warning: '#f59e0b',
    Critical: '#ef4444',
    Unscored: '#94a3b8'
};

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

// --- MAIN UI COMPONENT ---
const App = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isBulkDiagnosing, setIsBulkDiagnosing] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [diagnosing, setDiagnosing] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [activePieIndex, setActivePieIndex] = useState(null);

    // --- Effects ---

    // Handle routing based on URL hash
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            if (['dashboard', 'inventory', 'upload', 'specs'].includes(hash)) {
                setActiveTab(hash);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange(); // Initial check

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Handle search term changes with debounce
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchAssets(searchTerm);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);


    // --- Data Fetching & Actions ---

    const fetchAssets = async (search = '') => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/assets/', { params: { search } });
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
            await fetchAssets(searchTerm);
        } catch (err) {
            console.error("Diagnostic Loop Error:", err);
        } finally {
            setDiagnosing(null);
        }
    };

    const handleBulkDiagnose = async () => {
        try {
            setIsBulkDiagnosing(true);
            setError(null);
            await api.post('/assets/bulk-diagnose');

            // Refresh assets after a longer delay to allow backend processing
            setTimeout(() => {
                fetchAssets(searchTerm).finally(() => {
                    setIsBulkDiagnosing(false);
                });
            }, 2000);
        } catch (err) {
            console.error("Bulk Diagnosis Failed:", err);
            setError("Failed to trigger bulk diagnosis.");
            setIsBulkDiagnosing(false);
        }
    };

    const handleOverride = (assetId) => {
        const asset = assets.find(a => a.asset_id === assetId);
        setSelectedAsset(asset);
        console.log("Overriding asset:", asset);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        window.location.hash = tab;
    };

    const handlePieClick = (data) => {
        setSearchTerm(data.name);
        handleTabChange('inventory');
    };

    // --- Memoized Calculations ---

    const getEffectiveHealthScore = (asset) => asset.override_score || asset.health_score;

    const stats = useMemo(() => {
        return {
            total: assets.length,
            critical: assets.filter(a => getEffectiveHealthScore(a) === 'Critical').length,
            warning: assets.filter(a => getEffectiveHealthScore(a) === 'Warning').length,
            healthy: assets.filter(a => getEffectiveHealthScore(a) === 'Healthy').length,
            unscored: assets.filter(a => getEffectiveHealthScore(a) === 'Unscored').length
        };
    }, [assets]);

    const pieData = [
        { name: 'Healthy', value: stats.healthy },
        { name: 'Warning', value: stats.warning },
        { name: 'Critical', value: stats.critical },
    ].filter(d => d.value > 0);

    const atRiskAssets = useMemo(() => {
        const statusPriority = { 'Critical': 1, 'Warning': 2 };
        return assets
            .filter(a => ['Critical', 'Warning'].includes(getEffectiveHealthScore(a)))
            .sort((a, b) => {
                const scoreA = getEffectiveHealthScore(a);
                const scoreB = getEffectiveHealthScore(b);
                if (statusPriority[scoreA] !== statusPriority[scoreB]) {
                    return statusPriority[scoreA] - statusPriority[scoreB];
                }
                return b.current_age - a.current_age; // Secondary sort: oldest first
            })
            .slice(0, 4);
    }, [assets]);

    const filteredAssets = assets;

    // --- Render Logic ---

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatCard label="Inventory" value={stats.total} icon={<Package className="text-blue-600"/>} color="blue"/>
                            <StatCard label="Critical" value={stats.critical} icon={<AlertCircle className="text-red-600"/>} color="red"/>
                            <StatCard label="Warning" value={stats.warning} icon={<AlertTriangle className="text-amber-600"/>} color="amber"/>
                            <StatCard label="Healthy" value={stats.healthy} icon={<CheckCircle2 className="text-green-600"/>} color="green"/>
                        </div>
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
                                                    activeIndex={activePieIndex}
                                                    onMouseEnter={(_, index) => setActivePieIndex(index)}
                                                    onMouseLeave={() => setActivePieIndex(null)}
                                                    onClick={handlePieClick}
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell
                                                            key={entry.name}
                                                            fill={COLORS[entry.name]}
                                                            style={{
                                                                transform: activePieIndex === index ? 'scale(1.05)' : 'scale(1)',
                                                                transformOrigin: 'center center',
                                                                transition: 'transform 0.2s ease-in-out',
                                                                cursor: 'pointer'
                                                            }}
                                                        />
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
                                    <button onClick={() => handleTabChange('inventory')} className="text-xs font-bold text-blue-600 hover:underline">View All</button>
                                </div>
                                <div className="space-y-4">
                                    {atRiskAssets.map(asset => (
                                        <div key={asset.id} className="group flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${getEffectiveHealthScore(asset) === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
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
                                    {atRiskAssets.length === 0 && (
                                        <div className="py-20 text-center text-slate-300 italic">No assets currently flagged for review.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'inventory':
                return <Inventory filteredAssets={filteredAssets} handleDiagnose={handleDiagnose} diagnosing={diagnosing} getStatusColor={getStatusColor} handleOverride={handleOverride} />;
            case 'upload':
                return <BulkUpload />;
            case 'specs':
                return <SystemConfig />;
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
            <nav className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
                <div className="p-6 flex items-center gap-3 border-b border-slate-800">
                    <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/20">
                        <Activity className="text-white" size={24} />
                    </div>
                    <h1 className="text-xl font-black tracking-tighter uppercase">OptiAsset <span className="text-blue-500">Pro</span></h1>
                </div>
                <div className="flex-1 py-8 px-4 space-y-2">
                    <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
                    <NavItem icon={<Package size={20}/>} label="Inventory" active={activeTab === 'inventory'} onClick={() => handleTabChange('inventory')} />
                    <NavItem icon={<Upload size={20}/>} label="Bulk Upload" active={activeTab === 'upload'} onClick={() => handleTabChange('upload')} />
                    <NavItem icon={<Settings size={20}/>} label="System Config" active={activeTab === 'specs'} onClick={() => handleTabChange('specs')} />
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

            <main className="flex-1 overflow-y-auto relative">
                <header className="sticky top-0 bg-slate-50/80 backdrop-blur-md px-10 py-6 flex justify-between items-center z-10 border-b border-slate-200/50">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight capitalize">{activeTab}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{error ? 'System Offline' : 'Engine Synced'}</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="text" placeholder="Find asset..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <button onClick={handleBulkDiagnose} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition shadow-sm" title="Run Bulk Diagnosis">
                            <Activity size={20} className={loading ? 'animate-pulse' : ''} />
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
                    {isBulkDiagnosing ? (
                        <div className="flex flex-col justify-center items-center h-96 text-center">
                            <RefreshCw className="animate-spin text-blue-600" size={48} />
                            <h3 className="mt-6 text-xl font-black text-slate-700">Running Bulk Diagnosis...</h3>
                            <p className="mt-2 text-sm text-slate-500">This may take a moment. The asset list will refresh automatically when complete.</p>
                        </div>
                    ) : (
                        renderContent()
                    )}
                </div>
            </main>
        </div>
    );
};

// --- HELPER COMPONENTS ---

const NavItem = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-widest ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-x-1' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
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
                <div className="w-1.s h-1.5 rounded-full bg-slate-200"></div>
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
            <p className="text-4xl font-black text-slate-800 leading-none tracking-tighter">{value}</p>
        </div>
    );
};

export default App;