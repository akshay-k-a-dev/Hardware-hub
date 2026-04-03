import { useEffect, useRef, useCallback } from 'react';

/**
 * GooeyText — A premium liquid-morphing text animation component.
 *
 * This refined version uses a continuous time-based loop to ensure a 
 * perfectly seamless transition between words without any visible cuts.
 *
 * Props:
 *   texts        — string[]  phrases to cycle through
 *   morphTime    — number    seconds for the actual morphing transition (default 1.8)
 *   cooldownTime — number    seconds to hold/pause on each word (default 0.6)
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
    const rafRef = useRef(null);
    const timeRef = useRef(0);
    const lastFrameRef = useRef(performance.now());
    const currentIndexRef = useRef(0);

    const cycleTime = morphTime + cooldownTime;

    // ── Update styles based on eased progress ────────────────
    const updateStyles = useCallback((fraction) => {
        // We use a smoother easing curve for the morph phase (progress 0 → 1)
        // This ensures the transition is fluid and avoids harsh edges.
        const eased = fraction <= 0 ? 0 : fraction >= 1 ? 1 : 
                     fraction < 0.5 ? 2 * fraction * fraction : 1 - Math.pow(-2 * fraction + 2, 2) / 2;

        // Clamp blur to a soft range (max 20px) to keep text readable
        const blur1 = Math.min(eased * 15, 20);
        const blur2 = Math.min((1 - eased) * 15, 20);

        if (text1Ref.current) {
            text1Ref.current.style.filter = `blur(${blur1}px)`;
            text1Ref.current.style.opacity = `${1 - eased}`;
        }
        if (text2Ref.current) {
            text2Ref.current.style.filter = `blur(${blur2}px)`;
            text2Ref.current.style.opacity = `${eased}`;
        }
    }, []);

    // ── Main Animation Loop ──────────────────────────────────
    const tick = useCallback(
        (now) => {
            const dt = (now - lastFrameRef.current) / 1000;
            lastFrameRef.current = now;
            timeRef.current += dt;

            // Calculate total cycles and current local progress
            const totalProgress = timeRef.current / cycleTime;
            const cycleIndex = Math.floor(totalProgress);
            const localProgress = totalProgress - cycleIndex; // 0 to 1

            // Determine if we need to update the text content for the next cycle
            const actualIndex = cycleIndex % texts.length;
            if (actualIndex !== currentIndexRef.current) {
                currentIndexRef.current = actualIndex;
                const nextIndex = (actualIndex + 1) % texts.length;
                
                // Update text content only when cross-faded out or starting fresh
                // This prevents visual "popping" of text
                if (text1Ref.current) text1Ref.current.textContent = texts[actualIndex];
                if (text2Ref.current) text2Ref.current.textContent = texts[nextIndex];
            }

            // Define the pause vs morph windows within the cycle
            // cooldownTime is the 'pause' at the start of the cycle
            const pauseRatio = cooldownTime / cycleTime;
            
            if (localProgress < pauseRatio) {
                // Pause phase: fully visible word A
                updateStyles(0);
            } else {
                // Morph phase: Word A → Word B
                // Normalize progress to 0-1 within the morphing window
                const morphedProgress = (localProgress - pauseRatio) / (1 - pauseRatio);
                updateStyles(morphedProgress);
            }

            rafRef.current = requestAnimationFrame(tick);
        },
        [texts, cycleTime, cooldownTime, updateStyles]
    );

    useEffect(() => {
        // Initial setup
        if (text1Ref.current) text1Ref.current.textContent = texts[0];
        if (text2Ref.current) text2Ref.current.textContent = texts[1] ?? texts[0];

        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafRef.current);
    }, [texts, tick]);

    const filterId = 'gooey-morph-filter-seamless';

    return (
        <div className={`relative ${className}`}>
            <svg
                className="absolute w-0 h-0 invisible"
                aria-hidden="true"
            >
                <defs>
                    <filter id={filterId}>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0
                                    0 1 0 0 0
                                    0 0 1 0 0
                                    0 0 0 16 -7"
                            result="gooey"
                        />
                        <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
                    </filter>
                </defs>
            </svg>

            <div
                className="relative inline-grid place-items-center"
                style={{ filter: `url(#${filterId})` }}
            >
                {/* 
                    Using 'Inter Tight' for a more premium, modern feel.
                    Reduced tracking-tight for a sophisticated aesthetic.
                */}
                <span
                    ref={text1Ref}
                    aria-hidden="true"
                    className="col-start-1 row-start-1 select-none font-inter-tight
                               text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl
                               font-semibold tracking-tight leading-tight text-white
                               whitespace-nowrap"
                />
                <span
                    ref={text2Ref}
                    aria-hidden="true"
                    className="col-start-1 row-start-1 select-none font-inter-tight
                               text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl
                               font-semibold tracking-tight leading-tight text-white
                               whitespace-nowrap"
                    style={{ opacity: 0 }}
                />

                <span className="sr-only">
                    {texts.join(', ')}
                </span>
            </div>
        </div>
    );
}
