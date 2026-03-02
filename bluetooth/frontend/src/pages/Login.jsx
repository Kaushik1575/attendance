import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, ArrowLeft, ShieldCheck, GraduationCap, Laptop, UserCheck, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { API } from '../lib/api';

const Login = () => {
    const { role } = useParams(); // 'teacher' or 'student'
    const navigate = useNavigate();
    const { login } = useAuth();
    const [identifier, setIdentifier] = useState('2302060'); // email for teacher, roll_no for student
    const [password, setPassword] = useState('student123');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Dynamic content based on role
    const isTeacher = role === 'teacher';
    const themeClass = isTeacher ? 'bg-indigo-600' : 'bg-blue-600';
    const textThemeClass = isTeacher ? 'text-indigo-600' : 'text-blue-600';
    const borderThemeClass = isTeacher ? 'focus:border-indigo-500' : 'focus:border-blue-500';
    const shadowThemeClass = isTeacher ? 'shadow-indigo-500/30' : 'shadow-blue-500/30';

    const handleSubmit = async (e, force = false) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [isTeacher ? 'email' : 'roll_no']: identifier,
                    password,
                    role,
                    forceLogin: force
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success('Access Granted. Redirecting...');
                login(data.user, data.token);
                navigate(isTeacher ? '/teacher/dashboard' : '/student/dashboard');
            } else {
                toast.error(data.error || 'Invalid credentials');
            }
        } catch (err) {
            toast.error('Connection failure. Check if backend is alive.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
            {/* Left Side: Visual Sidebar (Hidden on Mobile) */}
            <div className={`hidden lg:flex flex-col justify-center px-12 xl:px-24 ${themeClass} relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-10 border border-white/20 shadow-xl">
                        {isTeacher ? <ShieldCheck size={32} className="text-white" /> : <GraduationCap size={32} className="text-white" />}
                    </div>

                    <h1 className="text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                        {isTeacher ? 'Faculty Portal' : 'Student Hub'}
                    </h1>

                    <p className="text-xl text-white/80 mb-12 max-w-md leading-relaxed">
                        {isTeacher
                            ? 'Authorize sessions, monitor real-time attendance, and manage your classroom with geo-precision.'
                            : 'Check-in securely via Bluetooth & GPS. Stay on track with your academic attendance records.'}
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-white/90">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                                <Laptop size={20} className="text-white" />
                            </div>
                            <span className="font-semibold text-lg">Secure Cloud Verification</span>
                        </div>
                        <div className="flex items-center gap-4 text-white/90">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                                <UserCheck size={20} className="text-white" />
                            </div>
                            <span className="font-semibold text-lg">Zero-Proxy Protection</span>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-10 left-12 xl:left-24 text-white/40 text-sm font-medium">
                    © 2026 GeoAttend System
                </div>
            </div>

            {/* Right Side: Form Side */}
            <div className="flex flex-col justify-center py-12 px-6 sm:px-12 lg:px-24 bg-white relative">
                <div className="max-w-md w-full mx-auto">
                    <div className="mb-10">
                        <h2 className="text-4xl font-black text-slate-900 mb-2">Welcome Back</h2>
                        <p className="text-slate-500 font-medium">Please enter your access details</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="form-group">
                            <label className="text-sm font-bold text-slate-700 block mb-2 uppercase tracking-wider">
                                {isTeacher ? 'Email Address' : 'Roll Number'}
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    {isTeacher ? <Mail size={20} /> : <GraduationCap size={20} />}
                                </div>
                                <input
                                    type={isTeacher ? 'email' : 'text'}
                                    autoComplete="username"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder={isTeacher ? 'faculty@college.edu' : 'Enter your roll number'}
                                    className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-semibold ${borderThemeClass} focus:bg-white transition-all outline-none`}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="text-sm font-bold text-slate-700 block mb-2 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-slate-900 font-semibold ${borderThemeClass} focus:bg-white transition-all outline-none`}
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
                            className={`w-full ${themeClass} hover:opacity-90 text-white font-bold py-4 rounded-2xl shadow-xl ${shadowThemeClass} transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0`}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Authenticating...</span>
                                </div>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <div className="mt-10 text-center space-y-4">
                        <p className="text-slate-500 font-medium">
                            {isTeacher ? (
                                <>Not authorized? <Link to="/register/teacher" className={`${textThemeClass} font-bold hover:underline`}>Join Faculty</Link></>
                            ) : (
                                <>New student? <Link to="/register" className={`${textThemeClass} font-bold hover:underline`}>Enroll Now</Link></>
                            )}
                        </p>

                        <Link
                            to="/"
                            className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 font-semibold mx-auto transition-colors text-sm"
                        >
                            <ArrowLeft size={16} /> Return to Home
                        </Link>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-6">
                        <Link
                            to={isTeacher ? "/login/student" : "/login/teacher"}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest inline-flex items-center gap-2"
                        >
                            Switch to {isTeacher ? 'Student' : 'Faculty'} Login →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
