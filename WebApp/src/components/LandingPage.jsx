import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Wifi, HardDrive, Smartphone, Zap, ArrowRight, Download, Server } from 'lucide-react';
import AuthImage from './ui/AuthImage';
import GlassCard from './ui/GlassCard';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-black text-white selection:bg-yellow-500/30 overflow-x-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-yellow-500/10 rounded-full blur-[120px] opacity-40 mix-blend-screen animate-pulse duration-[10s]" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] opacity-30 mix-blend-screen" />
            </div>

            {/* Header / Nav */}
            <nav className="relative z-50 flex items-center justify-between px-6 py-6 md:px-12 max-w-7xl mx-auto">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                        <Book size={18} className="text-black fill-current" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">WACR</span>
                </div>
                <div className="flex items-center gap-4">
                    <a href="https://github.com/robgola/WACR" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white/60 hover:text-white transition-colors">GitHub</a>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 flex flex-col items-center justify-center pt-20 pb-32 text-center px-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-white/80 tracking-wide uppercase">v1.0 Available Now</span>
                </div>

                <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40 drop-shadow-2xl max-w-4xl mx-auto leading-[0.9] animate-in fade-in zoom-in-95 duration-700 delay-100">
                    Your Comics.<br />
                    <span className="text-yellow-500 inline-block transform -skew-y-2">Antigravity.</span>
                </h1>

                <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    The premium web reader for your <strong>Komga</strong> server.
                    <br className="hidden md:block" />
                    Built for speed, offline reading, and pure aesthetic bliss.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                    <button
                        onClick={() => navigate('/app')}
                        className="group relative px-8 py-4 bg-white text-black font-bold rounded-full text-lg shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 overflow-hidden"
                    >
                        <span className="relative z-10">Launch App</span>
                        <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    </button>

                    <button
                        onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                        className="px-8 py-4 rounded-full font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all"
                    >
                        Learn more
                    </button>
                </div>

                {/* Simulated App UI Preview */}
                <div className="mt-24 relative w-full max-w-5xl mx-auto group perspective-1000 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
                    {/* Glow behind */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>

                    <div className="relative rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#1C1C1E] transform rotate-x-12 group-hover:rotate-0 transition-transform duration-700 ease-out origin-top h-[300px] md:h-[500px] flex items-center justify-center">
                        <div className="text-center">
                            <Smartphone size={64} className="mx-auto text-white/20 mb-4" />
                            <p className="text-white/40 font-mono text-sm">Interactive Preview Loading...</p>
                            <div className="mt-4 flex gap-2 justify-center">
                                {/* Fake UI Elements */}
                                <div className="w-16 h-24 bg-white/5 rounded-md border border-white/5" />
                                <div className="w-16 h-24 bg-white/5 rounded-md border border-white/5" />
                                <div className="w-16 h-24 bg-yellow-500/20 rounded-md border border-yellow-500/50" />
                                <div className="w-16 h-24 bg-white/5 rounded-md border border-white/5" />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Features Grid */}
            <section id="features" className="py-24 px-4 bg-black/50 relative z-20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Reading Reinvented</h2>
                        <p className="text-white/50 max-w-xl mx-auto">Standard readers are boring. WACR brings your library to life with physics, blur effects, and instant offline access.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Zap />}
                            title="Instant Sync"
                            desc="Connects directly to your Komga server. No complex setup, just your URL and credentials."
                        />
                        <FeatureCard
                            icon={<HardDrive />}
                            title="Native OPFS Storage"
                            desc="Uses the cutting-edge Origin Private File System to store gigabytes of comics directly in your browser."
                        />
                        <FeatureCard
                            icon={<Wifi />}
                            title="Offline First"
                            desc="Download entire series with one click. Read anywhere, even on a plane, with zero lag."
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-white/5 text-center text-white/30 text-sm">
                <p>&copy; {new Date().getFullYear()} Antigravity Project. Open Source.</p>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc }) => (
    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group">
        <div className="mb-4 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-white/60 leading-relaxed">{desc}</p>
    </div>
);

export default LandingPage;
