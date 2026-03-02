import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Calendar,
    Search, FileText,
    CheckCircle2, ArrowLeft, Loader2, User, Mail,
    Download, Send, Filter, X, ChevronRight, Hash, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GITA_LOGO } from '../utils/logoBase64';
import { API } from '../lib/api';

const SessionHistory = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    // Data
    const [sessions, setSessions] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobile = windowWidth <= 768;

    const filteredSessions = sessions.filter(s => {
        if (!dateFilter) return true;
        const d = new Date(s.start_time);
        const sessionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return sessionDate === dateFilter;
    });

    const isSessionLive = (session) => {
        return session && session.status === 'active' && new Date(session.expiry_time) > new Date();
    };

    const handleSessionSelect = (session) => {
        setSelectedSession(session);
        const sortedRecords = [...(session.records || [])].sort((a, b) => {
            const rollA = a.students?.roll_no?.toString().toLowerCase() || '';
            const rollB = b.students?.roll_no?.toString().toLowerCase() || '';
            return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
        });
        setFilteredRecords(sortedRecords);
        setSearchTerm('');
        if (isMobile) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const fetchHistory = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/sessions/detailed-history`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) {
                const fetchedSessions = data.sessions || [];
                setSessions(fetchedSessions);
                if (fetchedSessions.length > 0 && !selectedSession) {
                    handleSessionSelect(fetchedSessions[0]);
                }
            } else {
                toast.error(data.error || 'Failed to fetch history');
            }
        } catch (e) {
            toast.error('Connection timeout');
        } finally {
            setLoading(false);
        }
    }, [selectedSession, loading]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleSearch = (e) => {
        const term = e.target.value.toLowerCase();
        setSearchTerm(term);
        if (selectedSession) {
            const filtered = selectedSession.records.filter(r =>
                (r.students?.name || '').toLowerCase().includes(term) ||
                (r.students?.roll_no || '').toLowerCase().includes(term)
            );
            const sortedRecords = [...filtered].sort((a, b) => {
                const rollA = a.students?.roll_no?.toString().toLowerCase() || '';
                const rollB = b.students?.roll_no?.toString().toLowerCase() || '';
                return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
            });
            setFilteredRecords(sortedRecords);
        }
    };

    const downloadPDF = async () => {
        if (!selectedSession || filteredRecords.length === 0) return toast.error("No data");
        toast.loading("Exporting...", { id: 'pdf' });
        const doc = new jsPDF();
        try {
            doc.addImage(GITA_LOGO, 'PNG', 14, 10, 20, 20);
            doc.setFontSize(16);
            doc.text(`Subject: ${selectedSession.subject}`, 40, 18);
            doc.setFontSize(10);
            doc.text(`Date: ${new Date(selectedSession.start_time).toLocaleDateString()} | ${selectedSession.branch}-${selectedSession.section}`, 40, 24);
            autoTable(doc, {
                startY: 35,
                head: [['#', 'Name', 'Roll Number', 'Time']],
                body: filteredRecords.map((r, i) => [i + 1, r.students?.name, r.students?.roll_no, new Date(r.timestamp).toLocaleTimeString()]),
                theme: 'grid'
            });
            doc.save(`Attendance_${selectedSession.subject}.pdf`);
            toast.success("Ready", { id: 'pdf' });
        } catch (e) { toast.error("PDF Fail", { id: 'pdf' }); }
    };

    const sendEmailReport = (role) => {
        toast.success(`Report prepared for ${role}`);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased overflow-x-hidden selection:bg-indigo-100">
            {/* STICKY TOP NAV */}
            <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[101] px-4 md:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => (isMobile && selectedSession) ? setSelectedSession(null) : navigate('/teacher/dashboard')}
                        className="p-2 -ml-2 text-indigo-600 hover:bg-slate-100 rounded-xl transition-all active:scale-95"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            <Layers size={18} />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight hidden md:block">Analytics Vault</span>
                        {isMobile && selectedSession && <span className="font-bold text-indigo-600 truncate max-w-[150px]">{selectedSession.subject}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {loading && <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-widest"><Loader2 className="animate-spin" size={16} /> Syncing...</div>}
                    <button onClick={logout} className="text-sm font-black text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all uppercase tracking-widest">Exit</button>
                </div>
            </nav>

            <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8 items-start">

                    {/* SIDEBAR: NAVIGATION (Sticky on Desktop) */}
                    <div className={`space-y-6 md:sticky md:top-24 ${isMobile && selectedSession ? 'hidden' : 'block'}`}>
                        {/* Search & Filter */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Filter Records</span>
                                <Filter size={14} className="text-indigo-400" />
                            </div>
                            <div className="relative group">
                                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 text-sm font-bold transition-all"
                                />
                            </div>
                            {dateFilter && (
                                <button onClick={() => setDateFilter('')} className="mt-4 w-full py-2.5 text-xs font-black text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 uppercase tracking-widest leading-none">
                                    <X size={14} /> Clear Filter
                                </button>
                            )}
                        </div>

                        {/* Session List Scroll Area */}
                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Live History</span>
                                <span className="text-[11px] font-black text-indigo-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">{filteredSessions.length} Logs</span>
                            </div>
                            <div className="max-h-[calc(100vh-420px)] overflow-y-auto divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-200">
                                {filteredSessions.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleSessionSelect(s)}
                                        className={`w-full p-5 text-left transition-all hover:bg-slate-50/80 flex items-center justify-between gap-4 group ${selectedSession?.id === s.id ? 'bg-indigo-50/50' : 'bg-white'}`}
                                    >
                                        <div className="min-w-0">
                                            <div className={`text-md font-black truncate leading-tight mb-1 transition-colors ${selectedSession?.id === s.id ? 'text-indigo-600' : 'text-slate-800'}`}>{s.subject}</div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                <span>{s.branch}-{s.section}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <span>{new Date(s.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            {isSessionLive(s) && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse-slow mr-3 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />}
                                            <ChevronRight size={18} className={`shrink-0 transition-transform duration-300 ${selectedSession?.id === s.id ? 'translate-x-1 text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'}`} />
                                        </div>
                                    </button>
                                ))}
                                {filteredSessions.length === 0 && !loading && (
                                    <div className="p-12 text-center text-slate-300 flex flex-col items-center">
                                        <Calendar size={40} className="mb-4 opacity-20" />
                                        <p className="text-xs font-black uppercase tracking-widest">No Records Found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* MAIN CONTENT: SESSION INTELLIGENCE */}
                    <div className="min-w-0 space-y-6">
                        {/* Mobile Grid/Slider Switcher (Hidden on MD+) */}
                        {isMobile && selectedSession && (
                            <div className="overflow-x-auto pb-4 flex gap-3 -mx-4 px-4 scrollbar-hide">
                                {filteredSessions.slice(0, 10).map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleSessionSelect(s)}
                                        className={`shrink-0 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${selectedSession?.id === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100' : 'bg-white text-slate-500 border-slate-100 shadow-sm'}`}
                                    >
                                        {s.subject}
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedSession ? (
                            <div className="space-y-6 animate-fade-in">
                                {/* METRIC OVERLAY CARD */}
                                <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/40 group">
                                    <div className={`h-2.5 transition-all ${isSessionLive(selectedSession) ? 'bg-rose-500 shadow-[0_4px_12px_rgba(244,63,94,0.3)] animate-pulse' : 'bg-gradient-to-r from-indigo-600 to-violet-600'}`} />
                                    <div className="p-8 sm:p-12">
                                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                                            <div className="space-y-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white bg-indigo-600 px-3.5 py-1.5 rounded-full shadow-lg shadow-indigo-100 flex items-center gap-2">
                                                        <Clock size={12} /> Live Session Data
                                                    </span>
                                                    {isSessionLive(selectedSession) && (
                                                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-600 bg-rose-50 px-3.5 py-1.5 rounded-full border border-rose-100">
                                                            Active Now
                                                        </span>
                                                    )}
                                                </div>
                                                <h2 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tighter leading-none">{selectedSession.subject}</h2>
                                                <div className="flex flex-wrap items-center gap-y-3 gap-x-8 text-sm font-bold text-slate-400 uppercase tracking-widest">
                                                    <div className="flex items-center gap-3"><Users size={20} className="text-indigo-500" /> {selectedSession.branch}-{selectedSession.section}</div>
                                                    <div className="flex items-center gap-3"><Calendar size={20} className="text-indigo-500" /> {new Date(selectedSession.start_time).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                                    {selectedSession.time_slot && <div className="flex items-center gap-3"><Clock size={20} className="text-indigo-500" /> {selectedSession.time_slot}</div>}
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 rounded-[2rem] p-8 text-center min-w-[200px] border border-slate-100 shadow-inner group-hover:bg-indigo-50/30 transition-colors">
                                                <div className="text-6xl sm:text-7xl font-black text-indigo-600 leading-none mb-2 tracking-tighter">{filteredRecords.length}</div>
                                                <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Scholars Present</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Sub-Bar: Polished Controls */}
                                    <div className="bg-slate-50/50 border-t border-slate-100 p-6 md:px-12 md:py-8 flex flex-col md:flex-row gap-6">
                                        <div className="relative flex-1 group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                type="text"
                                                placeholder="Search by name or unique ID..."
                                                value={searchTerm}
                                                onChange={handleSearch}
                                                className="w-full pl-14 pr-6 py-4.5 bg-white border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 text-md font-bold shadow-sm transition-all"
                                            />
                                        </div>
                                        <div className="flex gap-3 shrink-0">
                                            <button
                                                onClick={downloadPDF}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-4.5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-black hover:shadow-2xl transition-all active:scale-95 shadow-lg"
                                            >
                                                <Download size={20} /> Export <span className="hidden lg:inline">Records</span>
                                            </button>
                                            <div className="flex items-center gap-2 bg-white border-2 border-slate-100 p-2 rounded-[1.5rem] shadow-sm">
                                                <button onClick={() => sendEmailReport('HOD')} className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all hover:scale-110 active:scale-90" title="Email HOD"><Mail size={22} /></button>
                                                <div className="w-px h-8 bg-slate-100" />
                                                <button onClick={() => sendEmailReport('Principal')} className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all hover:scale-110 active:scale-90" title="Email Principal"><Send size={22} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* RECORD TABLE Area: High Polish */}
                                <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                                    {isMobile ? (
                                        <div className="divide-y divide-slate-100">
                                            {filteredRecords.map((r, i) => (
                                                <div key={r.id} className="p-6 flex items-center justify-between gap-4 active:bg-slate-50">
                                                    <div className="flex items-center gap-4 truncate">
                                                        <div className="w-12 h-12 shrink-0 bg-indigo-50 border-2 border-white rounded-2xl flex items-center justify-center text-indigo-600 font-black text-sm shadow-sm">
                                                            {r.students?.name?.charAt(0) || <User size={18} />}
                                                        </div>
                                                        <div className="truncate">
                                                            <div className="text-md font-black text-slate-900 truncate tracking-tight mb-0.5">{r.students?.name}</div>
                                                            <div className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">{r.students?.roll_no}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0 space-y-2">
                                                        <div className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">Present</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50/50 text-left text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100">
                                                        <th className="px-10 py-6 w-24">Pos</th>
                                                        <th className="px-10 py-6">Scholar Identity</th>
                                                        <th className="px-10 py-6">Unique ID</th>
                                                        <th className="px-10 py-6">Check-in</th>
                                                        <th className="px-10 py-6 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredRecords.map((r, i) => (
                                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-all group cursor-default">
                                                            <td className="px-10 py-6 text-sm font-black text-slate-300 group-hover:text-indigo-400 transition-colors">{(i + 1).toString().padStart(2, '0')}</td>
                                                            <td className="px-10 py-6">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-11 h-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-indigo-600 font-extrabold shadow-sm group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                                                                        {r.students?.name?.charAt(0)}
                                                                    </div>
                                                                    <span className="text-md font-black text-slate-800 tracking-tight">{r.students?.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-10 py-6 text-sm font-black text-indigo-600 tabular-nums tracking-widest uppercase">{r.students?.roll_no}</td>
                                                            <td className="px-10 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                            <td className="px-10 py-6 text-center">
                                                                <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] border border-emerald-100">
                                                                    <CheckCircle2 size={14} /> Verified
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {filteredRecords.length === 0 && (
                                        <div className="py-32 text-center flex flex-col items-center justify-center space-y-4">
                                            <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 shadow-inner"><Users size={48} /></div>
                                            <h4 className="text-2xl font-black text-slate-800">No Scholars Logged</h4>
                                            <p className="text-sm font-bold text-slate-400 max-w-xs mx-auto">This time segment currently contains zero attendance entries.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-[70vh] flex items-center justify-center">
                                <div className="text-center bg-white p-16 rounded-[3rem] border-2 border-dashed border-slate-200 shadow-sm max-w-[450px] space-y-8 animate-pulse-slow">
                                    <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-200 mx-auto shadow-inner">
                                        <Layers size={48} />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">History Selector</h3>
                                        <p className="text-md font-semibold text-slate-400 leading-relaxed italic">Select an archive from the vault to decrypt student identities and verified check-in data.</p>
                                    </div>
                                    <div className="flex justify-center gap-4">
                                        <div className="w-3 h-3 rounded-full bg-indigo-600" />
                                        <div className="w-3 h-3 rounded-full bg-slate-100" />
                                        <div className="w-3 h-3 rounded-full bg-slate-100" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SessionHistory;
