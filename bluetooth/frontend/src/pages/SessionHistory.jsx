import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
    Users, Clock, Calendar,
    Search, FileText,
    CheckCircle2, ArrowLeft, Loader2, User, Mail,
    ChevronRight, Download, Send, Filter, X
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

    useEffect(() => {
        if (filteredSessions.length > 0) {
            const isStillVisible = selectedSession && filteredSessions.some(s => s.id === selectedSession.id);
            if (!isStillVisible) {
                handleSessionSelect(filteredSessions[0]);
            }
        } else if (!loading) {
            setSelectedSession(null);
            setFilteredRecords([]);
        }
    }, [dateFilter, sessions]);

    const fetchHistory = useCallback(async () => {
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
            console.error(e);
            toast.error('Server error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [selectedSession]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

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
        try {
            if (!selectedSession || filteredRecords.length === 0) {
                toast.error("No records to export!");
                return;
            }

            toast.loading("Generating PDF...", { id: 'pdf-toast' });

            const doc = new jsPDF();
            let logoAdded = false;

            try {
                doc.addImage(GITA_LOGO, 'PNG', 14, 10, 25, 25);
                logoAdded = true;
            } catch (e) {
                console.warn('Could not inject base64 logo.', e);
            }

            const textStartX = logoAdded ? 45 : 14;

            doc.setFontSize(18);
            doc.text(`Attendance Report: ${selectedSession.subject}`, textStartX, 18);
            doc.setFontSize(11);
            doc.text(`Date: ${new Date(selectedSession.start_time).toLocaleDateString()} | Branch: ${selectedSession.branch}-${selectedSession.section}`, textStartX, 26);
            if (selectedSession.time_slot) {
                doc.text(`Time Slot: ${selectedSession.time_slot}`, textStartX, 32);
            }

            const tableColumn = ["#", "Student Name", "Roll Number", "Status", "Time"];
            const tableRows = filteredRecords.map((r, i) => [
                i + 1,
                r.students?.name || 'Unknown',
                r.students?.roll_no || 'N/A',
                "PRESENT",
                new Date(r.timestamp || new Date()).toLocaleTimeString()
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: logoAdded ? 45 : 40,
                theme: 'striped'
            });

            doc.save(`Attendance_${selectedSession.subject}.pdf`);
            toast.success("PDF Downloaded successfully!", { id: 'pdf-toast' });

        } catch (err) {
            console.error("PDF Export Error:", err);
            toast.error("Failed to generate PDF: " + err.message, { id: 'pdf-toast' });
        }
    };

    const sendEmailReport = async (recipientRole, recipientEmail) => {
        try {
            if (!selectedSession || filteredRecords.length === 0) {
                toast.error("No records to export!");
                return;
            }

            toast.loading(`Automating PDF Attachment for ${recipientRole}...`, { id: 'email-toast' });

            const doc = new jsPDF();
            let logoAdded = false;

            try {
                doc.addImage(GITA_LOGO, 'PNG', 14, 10, 25, 25);
                logoAdded = true;
            } catch (e) {
                console.warn('Could not inject base64 logo.', e);
            }

            const textStartX = logoAdded ? 45 : 14;

            doc.setFontSize(18);
            doc.text(`Attendance Report: ${selectedSession.subject}`, textStartX, 18);
            doc.setFontSize(11);
            doc.text(`Date: ${new Date(selectedSession.start_time).toLocaleDateString()} | Branch: ${selectedSession.branch}-${selectedSession.section}`, textStartX, 26);
            if (selectedSession.time_slot) {
                doc.text(`Time Slot: ${selectedSession.time_slot}`, textStartX, 32);
            }

            const tableColumn = ["#", "Student Name", "Roll Number", "Status", "Time"];
            const tableRows = filteredRecords.map((r, i) => [
                i + 1,
                r.students?.name || 'Unknown',
                r.students?.roll_no || 'N/A',
                "PRESENT",
                new Date(r.timestamp || new Date()).toLocaleTimeString()
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: logoAdded ? 45 : 40,
                theme: 'striped'
            });

            const pdfBase64 = doc.output('datauristring');
            const filename = `Attendance_${selectedSession.subject}.pdf`;

            const res = await fetch(`${API}/api/reports/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipientEmail,
                    subject: `Attendance Report: ${selectedSession.subject} (${selectedSession.branch}-${selectedSession.section})`,
                    body: `
                        <h2>Daily Attendance Report</h2>
                        <p>Dear ${recipientRole},</p>
                        <p>Please find attached the latest attendance report generated from GeoAttend.</p>
                        <ul>
                            <li><b>Subject:</b> ${selectedSession.subject}</li>
                            <li><b>Branch:</b> ${selectedSession.branch} - Section ${selectedSession.section}</li>
                            <li><b>Date:</b> ${new Date(selectedSession.start_time).toLocaleDateString()}</li>
                            <li><b>Time Slot:</b> ${selectedSession.time_slot || 'N/A'}</li>
                            <li><b>Total Present:</b> ${filteredRecords.length} Students</li>
                        </ul>
                        <p>Best Regards,<br/>GeoAttend System</p>
                    `,
                    pdfBase64,
                    filename
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send email');

            toast.success(`Sent to ${recipientRole} with PDF Attached!`, { id: 'email-toast' });

        } catch (err) {
            console.error("Automated Email Error:", err);
            toast.error("Failed to attach & send: " + err.message, { id: 'email-toast' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Header / Navbar */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => (isMobile && selectedSession) ? setSelectedSession(null) : navigate('/teacher/dashboard')}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-indigo-600"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-800">
                            {isMobile && selectedSession ? 'Session Logic' : 'History Vault'}
                        </h1>
                    </div>
                    <button
                        onClick={logout}
                        className="text-xs font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                        Sign Out
                    </button>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                <div className="grid lg:grid-cols-[340px_1fr] gap-8">

                    {/* Sidebar: Session Sorter */}
                    <div className={`space-y-6 ${isMobile && selectedSession ? 'hidden' : 'block'}`}>
                        {/* Search & Filter Card */}
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4">
                                <Filter size={14} className="text-indigo-600" />
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Chronology</span>
                            </div>
                            <div className="relative">
                                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 transition-all outline-none font-semibold text-sm"
                                />
                            </div>
                            {dateFilter && (
                                <button
                                    onClick={() => setDateFilter('')}
                                    className="mt-3 w-full py-2 flex items-center justify-center gap-2 text-indigo-600 font-bold text-xs hover:bg-indigo-50 rounded-xl transition-all"
                                >
                                    <X size={14} /> Reset Filter
                                </button>
                            )}
                        </div>

                        {/* Session List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Recent Records</span>
                                {loading && <Loader2 className="animate-spin text-indigo-600" size={16} />}
                            </div>
                            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-400px)] pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                {filteredSessions.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleSessionSelect(s)}
                                        className={`w-full text-left group transition-all transform hover:-translate-y-0.5 ${selectedSession?.id === s.id
                                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 rounded-2xl p-5'
                                                : 'bg-white text-slate-700 shadow-sm border border-slate-200 rounded-2xl p-5 hover:border-indigo-200'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-black text-lg truncate pr-4">{s.subject}</h3>
                                            {isSessionLive(s) && (
                                                <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse mt-1.5 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-3 text-xs font-bold ${selectedSession?.id === s.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={14} />
                                                {new Date(s.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Users size={14} />
                                                {s.branch}-{s.section}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {filteredSessions.length === 0 && !loading && (
                                    <div className="p-8 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                        <Calendar className="mx-auto text-slate-200 mb-4" size={48} />
                                        <p className="text-sm font-bold text-slate-400">Empty Logs</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content: Intelligence Panel */}
                    <div className="space-y-6">
                        {/* Horizontal Switcher (Mobile Only) */}
                        {isMobile && selectedSession && filteredSessions.length > 1 && (
                            <div className="space-y-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Switch Archive</span>
                                <div className="flex gap-4 overflow-x-auto pb-4 px-2 scrollbar-hide">
                                    {filteredSessions.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleSessionSelect(s)}
                                            className={`flex-shrink-0 w-40 p-4 rounded-2xl border-2 transition-all ${selectedSession?.id === s.id
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                                                    : 'bg-white border-slate-100 text-slate-600 shadow-sm'
                                                }`}
                                        >
                                            <h4 className="font-black text-sm truncate mb-1">{s.subject}</h4>
                                            <div className="flex items-center justify-between opacity-80">
                                                <p className="text-[10px] font-bold uppercase">{s.branch}-{s.section}</p>
                                                {isSessionLive(s) && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedSession ? (
                            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-fade-in transition-all">
                                {/* Session Stats Header */}
                                <div className="p-6 md:p-8 bg-gradient-to-br from-indigo-700 to-indigo-600 text-white relative overflow-hidden">
                                    {/* Abstract Patterns */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
                                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/10 rounded-full blur-2xl -ml-10 -mb-10" />

                                    <div className="relative z-10 grid md:grid-cols-[1fr_auto] gap-6 items-center">
                                        <div>
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                    Session Intelligence
                                                </span>
                                                {isSessionLive(selectedSession) && (
                                                    <span className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-rose-100">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                        Active Now
                                                    </span>
                                                )}
                                            </div>
                                            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-md">{selectedSession.subject}</h2>
                                            <div className="flex flex-wrap items-center gap-4 text-sm font-bold opacity-90">
                                                <div className="flex items-center gap-2"><Users size={16} /> {selectedSession.branch}-{selectedSession.section}</div>
                                                <div className="px-1.5 py-3 h-1 w-1 rounded-full bg-white/20 hidden md:block" />
                                                <div className="flex items-center gap-2"><Calendar size={16} /> {new Date(selectedSession.start_time).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                            </div>
                                            {selectedSession.time_slot && (
                                                <div className="mt-4 flex items-center gap-2 bg-black/10 w-fit px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide">
                                                    <Clock size={14} /> Schedule: {selectedSession.time_slot}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 text-center min-w-[140px]">
                                            <div className="text-4xl md:text-6xl font-black mb-1 leading-none">{filteredRecords.length}</div>
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Present Today</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Controls */}
                                <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-100 grid md:grid-cols-[1fr_auto] gap-6 items-center">
                                    <div className="relative">
                                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search scholar name or unique identifier..."
                                            value={searchTerm}
                                            onChange={handleSearch}
                                            className="w-full pl-12 pr-4 py-4 bg-white shadow-sm border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none font-bold text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={downloadPDF}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg active:scale-95"
                                        >
                                            <Download size={18} /> Export PDF
                                        </button>
                                        <div className="flex-1 md:flex-none flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
                                            <button
                                                onClick={() => sendEmailReport('HOD', 'jyotiranjansahoo485@gmail.com')}
                                                className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors tooltip"
                                                title="Send to HOD"
                                            >
                                                <Send size={18} />
                                            </button>
                                            <div className="w-px h-6 bg-slate-100" />
                                            <button
                                                onClick={() => sendEmailReport('Principal', 'jyotiranjansahoo485@gmail.com')}
                                                className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                                title="Send to Principal"
                                            >
                                                <Mail size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Scholar List */}
                                <div className="p-6 md:p-8">
                                    {isMobile ? (
                                        <div className="space-y-4">
                                            {filteredRecords.map((r, i) => (
                                                <div key={r.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shadow-sm capitalize">
                                                                {r.students?.name?.charAt(0) || <User size={16} />}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-slate-800 text-sm">{r.students?.name || 'Anonymous Student'}</h4>
                                                                <p className="text-[11px] font-black text-indigo-600 tracking-wider uppercase">{r.students?.roll_no || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black tracking-widest px-2 py-1 rounded-lg uppercase">Present</span>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/50 text-[10px] font-black text-slate-400 uppercase">
                                                        <span>Index #{i + 1}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock size={12} />
                                                            {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-separate border-spacing-y-3">
                                                <thead>
                                                    <tr className="text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">
                                                        <th className="pb-4 pl-6 w-20">Index</th>
                                                        <th className="pb-4">Scholar Identity</th>
                                                        <th className="pb-4">Tracking Code</th>
                                                        <th className="pb-4 text-center">Status</th>
                                                        <th className="pb-4 text-right pr-6">Check-in Time</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredRecords.map((r, i) => (
                                                        <tr key={r.id} className="bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-all group overflow-hidden">
                                                            <td className="py-4 pl-6 font-black text-slate-400 text-sm rounded-l-2xl border-l border-y border-slate-100">
                                                                {String(i + 1).padStart(2, '0')}
                                                            </td>
                                                            <td className="py-4 border-y border-slate-100">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-black shadow-sm group-hover:scale-110 transition-transform">
                                                                        {r.students?.name?.charAt(0) || <User size={18} />}
                                                                    </div>
                                                                    <span className="font-black text-slate-700">{r.students?.name || 'Unknown Student'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 font-black text-indigo-600 text-sm tracking-wider border-y border-slate-100 uppercase">
                                                                {r.students?.roll_no || 'N/A'}
                                                            </td>
                                                            <td className="py-4 text-center border-y border-slate-100">
                                                                <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase">
                                                                    <CheckCircle2 size={12} /> Present
                                                                </span>
                                                            </td>
                                                            <td className="py-4 text-right pr-6 font-bold text-slate-500 text-sm rounded-r-2xl border-r border-y border-slate-100">
                                                                {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {filteredRecords.length === 0 && (
                                        <div className="py-20 text-center flex flex-col items-center justify-center">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                                                <Users size={40} />
                                            </div>
                                            <h4 className="text-xl font-black text-slate-800 mb-2">Ghost Session</h4>
                                            <p className="text-slate-400 font-bold text-sm max-w-xs mx-auto">No scholars have registered presence in this time-slice yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl p-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-200 shadow-sm">
                                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-200 mb-8 animate-pulse-slow">
                                    <Clock size={48} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2">Ready for Archival Study</h3>
                                <p className="text-slate-400 font-bold max-w-sm">Select a session from the history vault to decrypt the attendance patterns and export verified logs.</p>
                                <div className="mt-10 flex gap-4">
                                    <div className="w-12 h-1.5 bg-indigo-600 rounded-full" />
                                    <div className="w-12 h-1.5 bg-slate-100 rounded-full" />
                                    <div className="w-12 h-1.5 bg-slate-100 rounded-full" />
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
