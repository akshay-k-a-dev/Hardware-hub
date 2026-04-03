import { useEffect, useRef, useCallback } from 'react';

/**
 * GooeyText — A premium liquid-morphing text animation component.
 *
 * Fixed "Blink" version:
 * Uses an alternating layer strategy where at any time:
 * - One layer is the "source" (Word A)
 * - One layer is the "destination" (Word B)
 * - The swap of content ONLY happens when a layer is completely invisible (opacity 0).
 */
export default function GooeyText({
    texts = ['Who Build', 'Who Explore', 'Who Innovate'],
    morphTime = 0.8,
    cooldownTime = 0.3,
    className = '',
}) {
    const textRef1 = useRef(null);
    const textRef2 = useRef(null);
    const rafRef = useRef(null);
    const stateRef = useRef({
        time: 0,
        lastNow: performance.now(),
        lastCycle: -1,
    });

    const cycleTime = morphTime + cooldownTime;

    const tick = useCallback((now) => {
        const state = stateRef.current;
        const dt = (now - state.lastNow) / 1000;
        state.lastNow = now;
        state.time += dt;

        // Normalized time for the loop
        const totalProgress = state.time / cycleTime;
        const cycleIndex = Math.floor(totalProgress);
        const localProgress = totalProgress - cycleIndex; // 0 to 1

        const idx = cycleIndex % texts.length;
        const nextIdx = (idx + 1) % texts.length;

        // Handle text content swapping without blink
        // We use an alternating strategy: 
        // Layer 1 = Word N, Layer 2 = Word N+1
        // Then swap responsibilities.
        
        if (state.lastCycle !== cycleIndex) {
            state.lastCycle = cycleIndex;
            // Immediate update for fluid transition
            if (cycleIndex % 2 === 0) {
                if (textRef1.current) textRef1.current.textContent = texts[idx];
                if (textRef2.current) textRef2.current.textContent = texts[nextIdx];
            } else {
                if (textRef2.current) textRef2.current.textContent = texts[idx];
                if (textRef1.current) textRef1.current.textContent = texts[nextIdx];
            }
        }

        // Character morphing and readable pause
        const pauseRatio = cooldownTime / cycleTime;
        let eased = 0;
        
        if (localProgress < (1 - pauseRatio)) {
            // Morph phase: Cubic Ease-In-Out for a much softer landing and more organic motion
            const t = localProgress / (1 - pauseRatio);
            eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        } else {
            // Pause phase: Hold character at 100% visible
            eased = 1;
        }

        // Transitions
        // If cycleIndex is even, we morph from Layer 1 (current) to Layer 2 (next)
        // If cycleIndex is odd, we morph from Layer 2 (current) to Layer 1 (next)
        
        const blurMax = 20;
        const blurLevel = eased * blurMax;
        const invBlurLevel = (1 - eased) * blurMax;

        if (cycleIndex % 2 === 0) {
            // Morph 1 -> 2
            if (textRef1.current) {
                textRef1.current.style.filter = `blur(${blurLevel}px)`;
                textRef1.current.style.opacity = 1 - eased;
            }
            if (textRef2.current) {
                textRef2.current.style.filter = `blur(${invBlurLevel}px)`;
                textRef2.current.style.opacity = eased;
            }
        } else {
            // Morph 2 -> 1
            if (textRef2.current) {
                textRef2.current.style.filter = `blur(${blurLevel}px)`;
                textRef2.current.style.opacity = 1 - eased;
            }
            if (textRef1.current) {
                textRef1.current.style.filter = `blur(${invBlurLevel}px)`;
                textRef1.current.style.opacity = eased;
            }
        }

        rafRef.current = requestAnimationFrame(tick);
    }, [texts, cycleTime, cooldownTime]);

    useEffect(() => {
        stateRef.current.lastNow = performance.now();
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [tick]);

    const filterId = 'gooey-morph-filter-premium';

    return (
        <div className={`relative ${className}`}>
            <svg className="absolute w-0 h-0 invisible" aria-hidden="true">
                <defs>
                    <filter id={filterId}>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
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
                <span
                    ref={textRef1}
                    aria-hidden="true"
                    className="col-start-1 row-start-1 select-none font-inter-tight
                               text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl
                               font-semibold tracking-tighter leading-tight text-white
                               whitespace-nowrap will-change-[filter,opacity]"
                />
                <span
                    ref={textRef2}
                    aria-hidden="true"
                    className="col-start-1 row-start-1 select-none font-inter-tight
                               text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl
                               font-semibold tracking-tighter leading-tight text-white
                               whitespace-nowrap will-change-[filter,opacity]"
                    style={{ opacity: 0 }}
                />

                <span className="sr-only">
                    {texts.join(', ')}
                </span>
            </div>
        </div>
    );
}
