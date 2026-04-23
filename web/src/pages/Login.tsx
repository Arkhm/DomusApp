import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff, Shield, Loader2, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Preencha todos os campos.');
            return;
        }

        setIsLoading(true);

        try {
            await login({ email, password });
            toast.success('Login realizado com sucesso!', {
                duration: 3000,
                position: 'top-right',
                style: {
                    background: '#16161f',
                    color: '#f0f0f5',
                    border: '1px solid #22c55e',
                },
                iconTheme: {
                    primary: '#22c55e',
                    secondary: '#16161f',
                },
            });
            navigate('/dashboard');
        } catch (error: any) {
            const message = error.response?.data?.error || 'Erro ao fazer login. Tente novamente.';
            toast.error(message, {
                position: 'top-right',
                style: {
                    background: '#16161f',
                    color: '#f0f0f5',
                    border: '1px solid #ef4444',
                },
                iconTheme: {
                    primary: '#ef4444',
                    secondary: '#16161f',
                },
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient background effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-accent-primary/[0.04] rounded-full blur-[150px]" />
                <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-accent-secondary/[0.03] rounded-full blur-[130px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-[420px] relative z-10"
            >
                {/* Card */}
                <div className="bg-bg-card/80 backdrop-blur-xl border border-border-primary/60 rounded-xl p-10 shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(108,99,255,0.04)]">
                    {/* Logo + Title */}
                    <div className="text-center mb-10">
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.15, duration: 0.5 }}
                            className="w-14 h-14 mx-auto mb-5 rounded-xl bg-gradient-to-br from-accent-gradient-start to-accent-gradient-end flex items-center justify-center shadow-[0_4px_20px_rgba(108,99,255,0.3)]"
                        >
                            <Shield className="w-7 h-7 text-white" />
                        </motion.div>
                        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">DomusApp</h1>
                        <p className="text-text-muted text-[13px] mt-1.5 font-medium">Painel Administrativo</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email field */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-[13px] font-medium text-text-secondary">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-text-muted" />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Digite seu email"
                                    autoComplete="email"
                                    className="w-full pl-11 pr-4 py-3.5 bg-bg-input/60 border border-border-primary rounded-lg text-text-primary placeholder-text-muted text-sm focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/30 focus:bg-bg-input transition-all duration-200"
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-[13px] font-medium text-text-secondary">
                                Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-text-muted" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Digite sua senha"
                                    autoComplete="current-password"
                                    className="w-full pl-11 pr-12 py-3.5 bg-bg-input/60 border border-border-primary rounded-lg text-text-primary placeholder-text-muted text-sm focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/30 focus:bg-bg-input transition-all duration-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit button */}
                        <motion.button
                            type="submit"
                            disabled={isLoading}
                            whileHover={{ scale: isLoading ? 1 : 1.015 }}
                            whileTap={{ scale: isLoading ? 1 : 0.985 }}
                            className="w-full py-3.5 px-4 mt-2 bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end text-white font-semibold rounded-lg shadow-[0_4px_16px_rgba(108,99,255,0.3)] hover:shadow-[0_6px_24px_rgba(108,99,255,0.4)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-[15px]"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                'Entrar no Sistema'
                            )}
                        </motion.button>
                    </form>
                </div>
            </motion.div>

            {/* Footer — pinned to bottom */}
            <div className="absolute bottom-6 left-0 right-0 text-center z-10">
                <p className="text-text-muted text-xs">
                    Acesso restrito a administradores do condomínio
                </p>
                <p className="text-text-muted/50 text-[11px] mt-1">
                    DomusApp v1.0.0 — Painel Web Admin
                </p>
            </div>
        </div>
    );
}
