import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Users, Eye, EyeOff, ArrowLeft, GraduationCap, Lock, ShieldCheck, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../lib/api';

export default function StudentLogin() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [rollNo, setRollNo] = useState('2302060')
    const [password, setPassword] = useState('student123')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e, force = false) => {
        if (e) e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_no: rollNo, password, role: 'student', forceLogin: force })
            });

            const data = await res.json();

            if (res.status === 409) {
                toast((t) => (
                    <div className="text-white">
                        <p className="font-bold mb-1 text-sm">Active Session Found</p>
                        <p className="text-xs mb-3 opacity-80">Another device is logged in. Terminate and sign in here?</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { toast.dismiss(t.id); handleSubmit(null, true); }}
                                className="bg-white text-primary-900 px-3 py-1 rounded text-xs font-bold"
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="bg-white/20 text-white px-3 py-1 rounded text-xs"
                            >
                                No
                            </button>
                        </div>
                    </div>
                ), { duration: 6000, style: { background: '#1e3a8a', padding: '16px' } });
                return;
            }

            if (res.ok) {
                toast.success('Signed in successfully!');
                login(data.user, data.token);
                navigate('/student/dashboard');
            } else {
                toast.error(data.error || 'Invalid credentials');
            }
        } catch (err) {
            toast.error('Connection failure. Check server status.');
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left Side - Info */}
            <div className="hidden lg:flex flex-col justify-center px-12 xl:px-24 bg-primary-600 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-accent-400/20 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-10 border border-white/20 shadow-xl">
                        <GraduationCap size={32} className="text-white" />
                    </div>

                    <h1 className="text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                        Student Hub
                    </h1>

                    <p className="text-xl text-white/80 mb-12 max-w-md leading-relaxed">
                        Check-in securely via Bluetooth & GPS. Stay on track with your academic attendance records.
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-white/90">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                                <ShieldCheck size={20} className="text-accent-300" />
                            </div>
                            <span className="font-semibold text-lg">Secure Cloud Verification</span>
                        </div>
                        <div className="flex items-center gap-4 text-white/90">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                                <UserCheck size={20} className="text-accent-300" />
                            </div>
                            <span className="font-semibold text-lg">Zero-Proxy Protection</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex flex-col justify-center py-12 px-6 sm:px-12 lg:px-24 bg-white relative">
                <div className="max-w-md w-full mx-auto">
                    <div className="mb-10">
                        <h2 className="text-4xl font-black text-slate-900 mb-2">Welcome Back</h2>
                        <p className="text-slate-500 font-medium">Please enter your access details</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="text-sm font-bold text-slate-700 block mb-2 uppercase tracking-wider">
                                Roll Number
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <GraduationCap size={20} />
                                </div>
                                <input
                                    type="text"
                                    value={rollNo}
                                    onChange={e => setRollNo(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-semibold focus:border-primary-500 focus:bg-white transition-all outline-none"
                                    placeholder="Enter your roll number"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-700 block mb-2 uppercase tracking-wider">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-slate-900 font-semibold focus:border-primary-500 focus:bg-white transition-all outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Signing In...</span>
                                </div>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <div className="mt-10 text-center space-y-4">
                        <p className="text-slate-500 font-medium">
                            New student? <button onClick={() => navigate('/register')} className="text-primary-600 font-bold hover:underline">Enroll Now</button>
                        </p>

                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 font-semibold mx-auto transition-colors text-sm"
                        >
                            <ArrowLeft size={16} /> Return to Home
                        </button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                        <button onClick={() => navigate('/admin/login')}
                            className="text-slate-400 hover:text-primary-600 font-medium text-sm transition-colors">
                            Admin Login Access →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

