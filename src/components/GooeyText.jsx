import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * GooeyText — A liquid-morphing text animation component.
 *
 * Uses an SVG feColorMatrix gooey filter to blend two overlapping
 * text layers as they cross-fade, producing a molten/merging look.
 *
 * Props:
 *   texts        — string[]  phrases to cycle through
 *   morphTime    — number    seconds for each morph transition  (default 1.2)
 *   cooldownTime — number    seconds to hold before next morph  (default 0.3)
 *   className    — string    extra Tailwind classes on the wrapper
 */
export default function GooeyText({
    texts = ['Who Build', 'Who Experiment', 'Who Innovate'],
    morphTime = 1.2,
    cooldownTime = 0.3,
    className = '',
}) {
    const text1Ref = useRef(null);
    const text2Ref = useRef(null);
    const morphRef = useRef(0);      // progress 0 → 1
    const cooldownRef = useRef(0);    // remaining cooldown seconds
    const indexRef = useRef(0);       // current phrase index
    const rafRef = useRef(null);
    const lastFrameRef = useRef(performance.now());
    const [rendered, setRendered] = useState(false);

    // ── helpers ──────────────────────────────────────────────
    const setMorphStyles = useCallback((frac) => {
        // frac 0 → 1 : text1 fully visible → text2 fully visible
        // We use blur to create the gooey "melt" between the two layers;
        // the SVG feColorMatrix then sharpens the blurred edges back,
        // producing the signature gooey merge.
        const blur1 = Math.min(4 / (1 - frac) - 4, 100);   // → ∞ as frac→1
        const blur2 = Math.min(4 / frac - 4, 100);          // → ∞ as frac→0

        if (text1Ref.current) {
            text1Ref.current.style.filter = `blur(${blur1}px)`;
            text1Ref.current.style.opacity = `${1 - frac}`;
        }
        if (text2Ref.current) {
            text2Ref.current.style.filter = `blur(${blur2}px)`;
            text2Ref.current.style.opacity = `${frac}`;
        }
    }, []);

    // ── animation loop ──────────────────────────────────────
    const tick = useCallback(
        (now) => {
            const dt = (now - lastFrameRef.current) / 1000;
            lastFrameRef.current = now;

            if (cooldownRef.current > 0) {
                cooldownRef.current -= dt;

                if (cooldownRef.current <= 0) {
                    // Advance to next phrase
                    const next = (indexRef.current + 1) % texts.length;
                    indexRef.current = next;

                    if (text1Ref.current)
                        text1Ref.current.textContent = texts[next];
                    if (text2Ref.current)
                        text2Ref.current.textContent =
                            texts[(next + 1) % texts.length];

                    morphRef.current = 0;
                }
            } else {
                morphRef.current += dt / morphTime;

                if (morphRef.current >= 1) {
                    morphRef.current = 1;
                    cooldownRef.current = cooldownTime;
                }

                setMorphStyles(morphRef.current);
            }

            rafRef.current = requestAnimationFrame(tick);
        },
        [texts, morphTime, cooldownTime, setMorphStyles],
    );

    // ── lifecycle ───────────────────────────────────────────
    useEffect(() => {
        // initial text content
        if (text1Ref.current) text1Ref.current.textContent = texts[0];
        if (text2Ref.current) text2Ref.current.textContent = texts[1] ?? texts[0];

        // small delay so the initial state paints first
        const t = setTimeout(() => setRendered(true), 50);

        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafRef.current);
            clearTimeout(t);
        };
    }, [texts, tick]);

    // ── SVG gooey filter (hidden, referenced by CSS) ────────
    const filterId = 'gooey-morph-filter';

    return (
        <div className={`relative ${className}`}>
            {/* Hidden SVG defining the gooey filter */}
            <svg
                className="absolute w-0 h-0"
                aria-hidden="true"
                style={{ position: 'absolute', width: 0, height: 0 }}
            >
                <defs>
                    <filter id={filterId}>
                        {/*
                          feGaussianBlur softens, then feColorMatrix with
                          a high alpha-channel multiplier (19) sharpens the
                          edges back, giving the liquid-merge effect.
                        */}
                        <feGaussianBlur
                            in="SourceGraphic"
                            stdDeviation="1"
                            result="blur"
                        />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0
                                    0 1 0 0 0
                                    0 0 1 0 0
                                    0 0 0 19 -9"
                            result="gooey"
                        />
                        <feComposite
                            in="SourceGraphic"
                            in2="gooey"
                            operator="atop"
                        />
                    </filter>
                </defs>
            </svg>

            {/* Text layers – stacked absolutely so they overlap */}
            <div
                className="relative inline-grid place-items-center"
                style={{ filter: `url(#${filterId})` }}
            >
                <span
                    ref={text1Ref}
                    aria-hidden="true"
                    className="col-start-1 row-start-1 select-none
                               text-3xl sm:text-4xl md:text-5xl lg:text-6xl
                               font-black tracking-tight text-white
                               whitespace-nowrap"
                />
                <span
                    ref={text2Ref}
                    aria-hidden="true"
                    className="col-start-1 row-start-1 select-none
                               text-3xl sm:text-4xl md:text-5xl lg:text-6xl
                               font-black tracking-tight text-white
                               whitespace-nowrap"
                    style={{ opacity: 0 }}
                />

                {/* Screen-reader accessible text */}
                <span className="sr-only">
                    {texts.join(', ')}
                </span>
            </div>
        </div>
    );
}
