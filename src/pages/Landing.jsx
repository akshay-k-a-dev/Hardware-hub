import { useEffect, useState } from 'react';
import { ArrowRight, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import GooeyText from '@/components/GooeyText';
import { Button } from '@/components/ui/button';

export default function Landing() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(t);
    }, []);

    return (
        <div className="relative min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a]">
            {/* ── Ambient background gradients ────────────────── */}
            <div className="pointer-events-none absolute inset-0 z-0">
                <div className="absolute -top-[30%] -left-[20%] h-[50vh] w-[50vh] md:h-[70vh] md:w-[70vh] rounded-full bg-white/[0.015] blur-[80px] md:blur-[120px]" />
                <div className="absolute -bottom-[20%] -right-[15%] h-[40vh] w-[40vh] md:h-[60vh] md:w-[60vh] rounded-full bg-white/[0.02] blur-[60px] md:blur-[100px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[60vh] w-[60vh] md:h-[80vh] md:w-[80vh] rounded-full bg-white/[0.008] blur-[100px] md:blur-[160px]" />
            </div>

            {/* ── Noise texture overlay ───── */}
            <div
                className="pointer-events-none absolute inset-0 z-[1] opacity-[0.02]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                }}
            />

            {/* ── Main content ────────────────────────────────── */}
            <div
                className={`relative z-10 flex flex-col items-center text-center px-5 sm:px-6
                    transition-all duration-[1400ms] ease-out
                    ${visible
                        ? 'opacity-100 translate-y-0 scale-100'
                        : 'opacity-0 translate-y-6 scale-[0.97]'
                    }`}
            >
                {/* Chip badge */}
                <div className="mb-6 sm:mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 backdrop-blur-sm">
                    <Cpu className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/50" />
                    <span className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.2em] text-white/50">
                        HardwareHub
                    </span>
                </div>

                {/* Static heading */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight text-white leading-[0.95]">
                    For Makers
                </h1>

                {/* Gooey animated subheading */}
                <div className="mt-4 sm:mt-6">
                    <GooeyText
                        texts={['Who Build', 'Who Explore', 'Who Innovate']}
                        morphTime={1.0}
                        cooldownTime={2.5}
                    />
                </div>

                {/* Soft glowing underline accent */}
                <div className="mt-8 sm:mt-10 h-px w-20 sm:w-32 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* Tagline */}
                <p className="mt-8 sm:mt-12 max-w-sm sm:max-w-xl text-sm sm:text-base font-medium leading-relaxed text-white/40 px-4 tracking-tight">
                    Borrow what you need. build what matters.
                </p>

                {/* CTA buttons */}
                <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto px-6 sm:px-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
                    <Button
                        asChild
                        className="h-12 w-full sm:w-auto px-10 rounded-full bg-white text-black font-semibold text-sm
                                   hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300
                                   shadow-[0_0_40px_rgba(255,255,255,0.08)] px-10"
                    >
                        <Link to="/register" className="text-base">
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                    <Button
                        asChild
                        variant="ghost"
                        className="h-12 w-full sm:w-auto px-10 rounded-full text-white/70 font-semibold text-sm
                                   border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:text-white
                                   transition-all duration-300 backdrop-blur-sm shadow-xl"
                    >
                        <Link to="/login" className="text-base">
                            Sign In
                        </Link>
                    </Button>
                </div>
            </div>

            {/* ── Bottom fade-out gradient ─────────────────────── */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 sm:h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-[2]" />
        </div>
    );
}
