import { useEffect, useState } from 'react';
import { ArrowRight, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import GooeyText from '@/components/GooeyText';
import { Button } from '@/components/ui/button';

export default function Landing() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger the entrance animation on mount
        const t = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(t);
    }, []);

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a]">
            {/* ── Ambient background gradients ────────────────── */}
            <div className="pointer-events-none absolute inset-0 z-0">
                {/* Top-left warm glow */}
                <div className="absolute -top-[30%] -left-[20%] h-[70vh] w-[70vh] rounded-full bg-white/[0.015] blur-[120px]" />
                {/* Bottom-right cool glow */}
                <div className="absolute -bottom-[20%] -right-[15%] h-[60vh] w-[60vh] rounded-full bg-white/[0.02] blur-[100px]" />
                {/* Center subtle radial */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[80vh] w-[80vh] rounded-full bg-white/[0.008] blur-[160px]" />
            </div>

            {/* ── Noise texture overlay (optional elegance) ───── */}
            <div
                className="pointer-events-none absolute inset-0 z-[1] opacity-[0.025]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                }}
            />

            {/* ── Main content ────────────────────────────────── */}
            <div
                className={`relative z-10 flex flex-col items-center text-center px-6
                    transition-all duration-[1400ms] ease-out
                    ${visible
                        ? 'opacity-100 translate-y-0 scale-100'
                        : 'opacity-0 translate-y-8 scale-[0.96]'
                    }`}
            >
                {/* Chip badge */}
                <div className="mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 backdrop-blur-sm">
                    <Cpu className="h-3.5 w-3.5 text-white/50" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                        HardwareHub
                    </span>
                </div>

                {/* Static heading */}
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white leading-[0.9]">
                    For Makers
                </h1>

                {/* Gooey animated subheading */}
                <div className="mt-4 sm:mt-6">
                    <GooeyText
                        texts={['Who Build', 'Who Experiment', 'Who Innovate']}
                        morphTime={1.2}
                        cooldownTime={0.3}
                    />
                </div>

                {/* Soft glowing underline accent */}
                <div className="mt-6 h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                {/* Tagline */}
                <p className="mt-8 max-w-md text-sm sm:text-base font-medium leading-relaxed text-white/40">
                    The inventory platform that gets out of your way.
                    <br className="hidden sm:block" />
                    Request, track, and manage lab hardware—effortlessly.
                </p>

                {/* CTA buttons */}
                <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
                    <Button
                        asChild
                        className="h-12 px-8 rounded-lg bg-white text-black font-bold text-sm
                                   hover:bg-white/90 transition-all duration-300
                                   shadow-[0_0_40px_rgba(255,255,255,0.08)]"
                    >
                        <Link to="/register">
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                    <Button
                        asChild
                        variant="ghost"
                        className="h-12 px-8 rounded-lg text-white/60 font-bold text-sm
                                   border border-white/10 hover:bg-white/[0.04] hover:text-white
                                   transition-all duration-300"
                    >
                        <Link to="/login">
                            Sign In
                        </Link>
                    </Button>
                </div>
            </div>

            {/* ── Bottom fade-out gradient ─────────────────────── */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-[2]" />
        </div>
    );
}
