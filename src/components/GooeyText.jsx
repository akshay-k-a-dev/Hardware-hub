import { useEffect, useRef, useCallback } from 'react';

/**
 * GooeyText — A liquid-morphing text animation component.
 *
 * Uses an SVG feColorMatrix gooey filter to blend two overlapping
 * text layers as they cross-fade, producing a molten/merging look.
 *
 * Props:
 *   texts        — string[]  phrases to cycle through
 *   morphTime    — number    seconds for each morph transition  (default 1.8)
 *   cooldownTime — number    seconds to hold before next morph  (default 0.6)
 *   className    — string    extra Tailwind classes on the wrapper
 */
export default function GooeyText({
    texts = ['Who Build', 'Who Explore', 'Who Innovate'],
    morphTime = 1.8,
    cooldownTime = 0.6,
    className = '',
}) {
    const text1Ref = useRef(null);
    const text2Ref = useRef(null);
    const morphRef = useRef(0);      // progress 0 → 1
    const cooldownRef = useRef(0);    // remaining cooldown seconds
    const indexRef = useRef(0);       // current phrase index
    const rafRef = useRef(null);
    const lastFrameRef = useRef(performance.now());

    // ── helpers ──────────────────────────────────────────────
    const setMorphStyles = useCallback((frac) => {
        // Apply a smooth easing curve (power ~0.7) so the transition
        // spends more time in the readable mid-range and less time
        // at the harsh fully-blurred extremes.
        const eased = Math.pow(frac, 0.7);

        // Clamp blur to a lower max (30px) to avoid harsh flicker spikes.
        // The formula ramps blur up as each layer fades out, but the clamp
        // keeps it readable throughout.
        const blur1 = Math.min(3 / (1 - eased + 0.01) - 3, 30);
        const blur2 = Math.min(3 / (eased + 0.01) - 3, 30);

        if (text1Ref.current) {
            text1Ref.current.style.filter = `blur(${blur1}px)`;
            text1Ref.current.style.opacity = `${1 - eased}`;
        }
        if (text2Ref.current) {
            text2Ref.current.style.filter = `blur(${blur2}px)`;
            text2Ref.current.style.opacity = `${eased}`;
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

        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafRef.current);
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
                        <feGaussianBlur
                            in="SourceGraphic"
                            stdDeviation="0.8"
                            result="blur"
                        />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0
                                    0 1 0 0 0
                                    0 0 1 0 0
                                    0 0 0 18 -8"
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
                               font-semibold tracking-tight leading-tight text-white
                               whitespace-nowrap"
                />
                <span
                    ref={text2Ref}
                    aria-hidden="true"
                    className="col-start-1 row-start-1 select-none
                               text-3xl sm:text-4xl md:text-5xl lg:text-6xl
                               font-semibold tracking-tight leading-tight text-white
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
