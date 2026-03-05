import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Calendar,
    FileText,
    CheckCircle2, ArrowLeft, Loader2, User, Mail,
    Download, Send, Filter, X, ChevronRight, Hash, Layers, UserPlus, Search as SearchIcon
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

    // State management for view flow
    const [viewState, setViewState] = useState('filter'); // 'filter' or 'detail'
    const [branchFilter, setBranchFilter] = useState('');
    const [sectionFilter, setSectionFilter] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');

    // Absentee logic
    const [absentees, setAbsentees] = useState([]);
    const [activeTab, setActiveTab] = useState('present'); // 'present' or 'absent'
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showStudentSearch, setShowStudentSearch] = useState(false);

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobile = windowWidth <= 768;

    const branches = ['CSE', 'CSE-AI', 'CSE-DS', 'IT', 'ECE', 'EEE', 'MECH'];
    const sections = ['1', '2', '3'];
    const semesters = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const subjects = ['ED', 'CD', 'SE', 'DL', 'CC', 'AW', 'Lecture', 'Lab'];

    const filteredSessions = sessions.filter(s => {
        const matchesDate = !dateFilter || (() => {
            const d = new Date(s.start_time);
            const sessionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return sessionDate === dateFilter;
        })();
        const matchesBranch = !branchFilter || s.branch === branchFilter;
        const matchesSection = !sectionFilter || s.section === sectionFilter;
        const matchesSemester = !semesterFilter || s.semester === semesterFilter;
        const matchesSubject = !subjectFilter || s.subject === subjectFilter;
        return matchesDate && matchesBranch && matchesSection && matchesSemester && matchesSubject;
    });

    const isSessionLive = (session) => {
        return session && session.status === 'active' && new Date(session.expiry_time) > new Date();
    };

    const fetchAbsentees = async (sessionId) => {
        try {
            const res = await fetch(`${API}/api/sessions/${sessionId}/absentees`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) {
                setAbsentees(data);
            }
        } catch (e) {
            console.error('Failed to fetch absentees');
        }
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
        setActiveTab('present');
        fetchAbsentees(session.id);
        setViewState('detail'); // Switch to detail view
        if (isMobile) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const markPresentManual = async (studentId) => {
        if (!selectedSession) return;
        try {
            const res = await fetch(`${API}/api/sessions/${selectedSession.id}/mark-present`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Attendance marked!');

                // Fetch latest history to update the sessions array
                const historyRes = await fetch(`${API}/api/sessions/detailed-history`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (historyRes.ok) {
                    const historyData = await historyRes.json();
                    const fetchedSessions = historyData.sessions || [];
                    setSessions(fetchedSessions);

                    // Find and update the selected session in local state
                    const updated = fetchedSessions.find(s => s.id === selectedSession.id);
                    if (updated) {
                        setSelectedSession(updated);
                        const sortedRecords = [...(updated.records || [])].sort((a, b) => {
                            const rollA = a.students?.roll_no?.toString().toLowerCase() || '';
                            const rollB = b.students?.roll_no?.toString().toLowerCase() || '';
                            return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
                        });
                        setFilteredRecords(sortedRecords);
                    }
                }

                // Also update absentees list
                fetchAbsentees(selectedSession.id);
            } else {
                toast.error(data.error || 'Failed to mark attendance');
            }
        } catch (e) {
            toast.error('Network error');
        }
    };

    const handleStudentSearchInput = async (e) => {
        const query = e.target.value;
        setStudentSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await fetch(`${API}/api/sessions/search-students?query=${query}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setSearchResults(data);
        } catch (e) { }
    };

    const fetchHistory = useCallback(async (manual = false) => {
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
                if (manual) toast.success(`Synced ${fetchedSessions.length} sessions`);

                // Remove automatic selection/redirect on load as per user request
                // We want them to see the filter form first.
            } else {
                toast.error(data.error || 'Failed to fetch history');
            }
        } catch (e) {
            toast.error('Connection timeout - Please check internet');
        } finally {
            setLoading(false);
        }
    }, [loading]);

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
            if (selectedSession.time_slot) {
                doc.text(`Class Time: ${selectedSession.time_slot}`, 40, 30);
            }
            autoTable(doc, {
                startY: selectedSession.time_slot ? 38 : 32,
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
                        onClick={() => {
                            if (viewState === 'detail') {
                                setViewState('results');
                            } else if (viewState === 'results') {
                                setViewState('filter');
                            } else {
                                navigate('/teacher/dashboard');
                            }
                        }}
                        className="p-2 -ml-2 text-indigo-600 hover:bg-slate-100 rounded-xl transition-all active:scale-95"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            <Layers size={18} />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight hidden md:block">Analytics Vault</span>
                        {isMobile && viewState === 'detail' && selectedSession && <span className="font-bold text-indigo-600 truncate max-w-[150px]">{selectedSession.subject}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {loading && <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-widest"><Loader2 className="animate-spin" size={16} /> Syncing...</div>}
                    <button onClick={logout} className="text-sm font-black text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all uppercase tracking-widest">Exit</button>
                </div>
            </nav >

            <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
                {viewState === 'filter' ? (
                    /* STEP 1: BEAUTIFUL FILTER FORM */
                    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in py-10">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-200 rotate-3">
                                <SearchIcon size={40} />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Session Archive</h1>
                            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] max-w-xs mx-auto">Select criteria to decrpt attendance records</p>
                        </div>

                        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* Date Filter */}
                                <div className="space-y-2 col-span-full">
                                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest ml-1">Select Date</label>
                                    <div className="relative group">
                                        <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="date"
                                            value={dateFilter}
                                            onChange={(e) => setDateFilter(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-bold transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Branch Filter */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest ml-1">Select Branch</label>
                                    <div className="relative group">
                                        <select
                                            value={branchFilter}
                                            onChange={(e) => setBranchFilter(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-bold transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">All Branches</option>
                                            {[...new Set([...branches, ...sessions.map(s => s.branch).filter(Boolean)])].sort().map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                        <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Section Filter */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest ml-1">Select Section</label>
                                    <div className="relative group">
                                        <select
                                            value={sectionFilter}
                                            onChange={(e) => setSectionFilter(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-bold transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">All Sections</option>
                                            {[...new Set([...sections, ...sessions.map(s => s.section).filter(Boolean)])].sort().map(s => <option key={s} value={s}>Section {s}</option>)}
                                        </select>
                                        <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Semester Filter */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest ml-1">Select Semester</label>
                                    <div className="relative group">
                                        <select
                                            value={semesterFilter}
                                            onChange={(e) => setSemesterFilter(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-bold transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">All Semesters</option>
                                            {[...new Set([...semesters, ...sessions.map(s => s.semester).filter(Boolean)])].sort((a, b) => a - b).map(s => <option key={s} value={s}>Semester {s}</option>)}
                                        </select>
                                        <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Subject Filter */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest ml-1">Select Subject</label>
                                    <div className="relative group">
                                        <select
                                            value={subjectFilter}
                                            onChange={(e) => setSubjectFilter(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-bold transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">All Subjects</option>
                                            {[...new Set([...subjects, ...sessions.map(s => s.subject).filter(Boolean)])].sort().map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6">
                                <button
                                    onClick={() => {
                                        if (filteredSessions.length > 0) {
                                            setViewState('results');
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        } else {
                                            fetchHistory(true);
                                        }
                                    }}
                                    className="w-full bg-indigo-600 text-white py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-slate-900 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    {loading ? (
                                        <><Loader2 className="animate-spin" size={18} /> Verifying Archives...</>
                                    ) : (
                                        <>Search Archives ({filteredSessions.length} Found) <ChevronRight size={18} /></>
                                    )}
                                </button>
                                {filteredSessions.length === 0 && !loading && (
                                    <p className="text-center text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">
                                        No archives found? <button onClick={() => fetchHistory(true)} className="text-indigo-600 hover:underline">Click here to Sync</button>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : viewState === 'results' ? (
                    /* STEP 2: SEARCH RESULTS LIST */
                    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in py-6">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-8">
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Search Results</h1>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Found {filteredSessions.length} matches for your criteria</p>
                            </div>
                            <button
                                onClick={() => setViewState('filter')}
                                className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline"
                            >
                                <Filter size={14} /> Back to Filters
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredSessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSessionSelect(s)}
                                    className="flex items-center justify-between p-8 bg-white border border-slate-100 rounded-[2.5rem] hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-50/50 transition-all group relative overflow-hidden text-left"
                                >
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="min-w-0 pr-4">
                                        <div className="text-[10px] font-black uppercase text-indigo-500 mb-2 tracking-widest leading-none">{s.branch}-{s.section} • SEM {s.semester}</div>
                                        <div className="font-black text-slate-800 text-xl truncate mb-2">{s.subject}</div>
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            <div className="flex items-center gap-2"><Calendar size={14} /> {new Date(s.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                                            <div className="flex items-center gap-2"><Users size={14} /> {s.records?.length || 0} Present</div>
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                        <ChevronRight size={24} />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {filteredSessions.length === 0 && (
                            <div className="py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 text-center space-y-6">
                                <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mx-auto">
                                    <SearchIcon size={48} />
                                </div>
                                <div className="space-y-2 px-6">
                                    <h3 className="text-xl font-black text-slate-900">No Archives Found</h3>
                                    <p className="text-slate-500 text-sm font-bold max-w-xs mx-auto">None of your saved sessions match the selected filters perfectly.</p>
                                </div>
                                <button
                                    onClick={() => setViewState('filter')}
                                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all active:scale-95 shadow-xl shadow-indigo-100"
                                >
                                    Try Different Filters
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* STEP 2: SESSION INTELLIGENCE (DETAILED VIEW) */
                    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8 items-start animate-fade-in">
                        {/* SIDEBAR: NAVIGATION (Sticky on Desktop) - Now optionally shows alternate sessions */}
                        <div className={`space-y-6 md:sticky md:top-24 hidden md:block`}>
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Other Matches</span>
                                    <button onClick={() => setViewState('filter')} className="text-[10px] font-black text-indigo-600 hover:underline">Change Criteria</button>
                                </div>
                                <div className="max-h-[calc(100vh-250px)] overflow-y-auto divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-200">
                                    {filteredSessions.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleSessionSelect(s)}
                                            className={`w-full p-5 text-left transition-all hover:bg-slate-50/80 flex items-center justify-between gap-4 group ${selectedSession?.id === s.id ? 'bg-indigo-50/50' : 'bg-white'}`}
                                        >
                                            <div className="min-w-0">
                                                <div className={`text-md font-black truncate leading-tight mb-1 transition-colors ${selectedSession?.id === s.id ? 'text-indigo-600' : 'text-slate-800'}`}>{s.subject}</div>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                    <span>{new Date(s.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className={`shrink-0 transition-transform duration-300 ${selectedSession?.id === s.id ? 'translate-x-1 text-indigo-600' : 'text-slate-300'}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* DETAIL AREA */}
                        <div className="min-w-0 space-y-6">
                            {/* Mobile Grid/Slider Switcher (Hidden on MD+) */}
                            {isMobile && selectedSession && (
                                <div className="overflow-x-auto pb-6 flex gap-3 -mx-4 px-4 scrollbar-hide">
                                    {filteredSessions.slice(0, 10).map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleSessionSelect(s)}
                                            className={`shrink-0 px-6 py-4 rounded-[1.25rem] border-2 transition-all active:scale-95 flex flex-col items-center justify-center min-w-[90px] ${selectedSession?.id === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100' : 'bg-white text-slate-600 border-slate-100 shadow-sm'}`}
                                        >
                                            <span className="text-[11px] font-black uppercase tracking-wider leading-none mb-1.5">{s.subject}</span>
                                            <span className={`text-[9px] font-bold uppercase tracking-widest ${selectedSession?.id === s.id ? 'text-indigo-100/80' : 'text-slate-400'}`}>
                                                {new Date(s.start_time).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                            </span>
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
                                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                                <input
                                                    type="text"
                                                    placeholder={activeTab === 'present' ? "Search present students..." : "Search absentees..."}
                                                    value={searchTerm}
                                                    onChange={handleSearch}
                                                    className="w-full pl-14 pr-6 py-4.5 bg-white border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 text-md font-bold shadow-sm transition-all"
                                                />
                                            </div>
                                            <div className="flex flex-col xl:flex-row gap-4 shrink-0">
                                                <button
                                                    onClick={() => setShowStudentSearch(true)}
                                                    className="flex-1 xl:flex-none flex items-center justify-center gap-3 bg-indigo-600 text-white px-8 py-3.5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-2xl transition-all active:scale-95 shadow-lg"
                                                >
                                                    <UserPlus size={20} /> Add Student
                                                </button>
                                                <button
                                                    onClick={downloadPDF}
                                                    className="flex-1 xl:flex-none flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-3.5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-black hover:shadow-2xl transition-all active:scale-95 shadow-lg"
                                                >
                                                    <Download size={20} /> Export PDF
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tab Toggle */}
                                    <div className="flex bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full sm:w-fit">
                                        <button
                                            onClick={() => setActiveTab('present')}
                                            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'present' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            Present ({filteredRecords.length})
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('absent')}
                                            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'absent' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            Absent ({absentees.length})
                                        </button>
                                    </div>

                                    {/* RECORD TABLE Area: High Polish */}
                                    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                                        {activeTab === 'present' ? (
                                            /* PRESENT STUDENTS VIEW */
                                            isMobile ? (
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
                                            )
                                        ) : (
                                            /* ABSENT STUDENTS VIEW */
                                            <div className="overflow-x-auto">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50/50 text-left text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100">
                                                            <th className="px-10 py-6">Scholar Identity</th>
                                                            <th className="px-10 py-6">Unique ID</th>
                                                            <th className="px-10 py-6 text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {absentees.filter(a =>
                                                            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                            a.roll_no.toLowerCase().includes(searchTerm.toLowerCase())
                                                        ).map((a) => (
                                                            <tr key={a.id} className="hover:bg-rose-50/30 transition-all group">
                                                                <td className="px-10 py-6">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-11 h-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-rose-500 font-extrabold shadow-sm">
                                                                            {a.name?.charAt(0)}
                                                                        </div>
                                                                        <span className="text-md font-black text-slate-800 tracking-tight">{a.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-10 py-6 text-sm font-black text-slate-500 tabular-nums tracking-widest uppercase cursor-pointer hover:text-indigo-600 transition-colors"
                                                                    onClick={() => markPresentManual(a.id)}>
                                                                    {a.roll_no}
                                                                </td>
                                                                <td className="px-10 py-6 text-center">
                                                                    <button
                                                                        onClick={() => markPresentManual(a.id)}
                                                                        className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                                                                    >
                                                                        <CheckCircle2 size={14} /> Mark Present
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {absentees.length === 0 && (
                                                    <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                                                        Everyone is present!
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {(activeTab === 'present' ? filteredRecords.length : absentees.length) === 0 && (
                                            <div className="py-32 text-center flex flex-col items-center justify-center space-y-4">
                                                <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 shadow-inner"><Users size={48} /></div>
                                                <h4 className="text-2xl font-black text-slate-800">No Records Found</h4>
                                                <p className="text-sm font-bold text-slate-400 max-w-xs mx-auto">Try adjusting your search or filters.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[60vh] flex items-center justify-center">
                                    <p className="text-slate-400 font-bold italic text-center">Select a session from the archives to view detailed attendance data.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* AD-HOC STUDENT SEARCH MODAL */}
            {
                showStudentSearch && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Add Scholar</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Manual Attendance Override</p>
                                </div>
                                <button onClick={() => { setShowStudentSearch(false); setStudentSearchQuery(''); setSearchResults([]); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="relative group">
                                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Roll No or Name..."
                                        value={studentSearchQuery}
                                        onChange={handleStudentSearchInput}
                                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-bold transition-all"
                                    />
                                </div>

                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                    {searchResults.map(s => (
                                        <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl transition-colors border-2 border-slate-50 hover:border-indigo-100 group">
                                            <div className="min-w-0">
                                                <div className="font-black text-slate-800 text-sm truncate">{s.name}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.roll_no} • {s.branch}-{s.section}</div>
                                            </div>
                                            <button
                                                onClick={() => { markPresentManual(s.id); setShowStudentSearch(false); }}
                                                className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm hover:bg-indigo-600 hover:text-white transition-all active:scale-90 border border-slate-100 group-hover:border-indigo-600"
                                            >
                                                <UserPlus size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    {studentSearchQuery.length >= 2 && searchResults.length === 0 && (
                                        <div className="text-center py-10 space-y-3">
                                            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-200 mx-auto"><User size={24} /></div>
                                            <p className="text-slate-400 font-bold text-xs uppercase italic tracking-widest">No scholars matched</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default SessionHistory;
