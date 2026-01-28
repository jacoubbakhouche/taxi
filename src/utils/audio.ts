// Advanced Audio Utility using Web Audio API (No files needed)

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export const playSound = (type: 'click' | 'notification' | 'ring' | 'offer') => {
    // 1. CLICK: Use Haptics (Vibration) - Best for UI
    if (type === 'click') {
        if (navigator.vibrate) navigator.vibrate(10); // Light tap
        return null;
    }

    // 2. Resume Context (Browsers require user interaction first)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    // --- Sound Designs ---
    if (type === 'notification') {
        // "Ding!" - Pleasant major triad
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        oscillator.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1); // C6
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        oscillator.start(now);
        oscillator.stop(now + 0.5);

        if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Buzz buzz
    }
    else if (type === 'offer') {
        // "Pop!" - Short upward chirp
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.linearRampToValueAtTime(880, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.2);

        oscillator.start(now);
        oscillator.stop(now + 0.2);

        if (navigator.vibrate) navigator.vibrate(50);
    }
    else if (type === 'ring') {
        // "Phone Ring" - Repeating trill (Simulated Loop)
        // We create a loop interval for ringing
        const playRingTone = () => {
            const t = audioCtx.currentTime;
            const o1 = audioCtx.createOscillator();
            const g1 = audioCtx.createGain();
            o1.connect(g1);
            g1.connect(audioCtx.destination);

            // Old phone style trill
            o1.type = 'square';
            o1.frequency.setValueAtTime(800, t);
            o1.frequency.linearRampToValueAtTime(1200, t + 0.05);

            g1.gain.setValueAtTime(0.1, t);
            g1.gain.linearRampToValueAtTime(0.01, t + 0.1); // Short blip

            o1.start(t);
            o1.stop(t + 0.1);
        };

        // Play a sequence: Ring... Ring...
        const intervalId = setInterval(() => {
            // Double blip
            playRingTone();
            setTimeout(playRingTone, 150);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }, 2000);

        // Return an object that mimics the Audio interface for stopping
        playRingTone(); // Immediate start
        return {
            pause: () => clearInterval(intervalId),
            currentTime: 0
        } as any;
    }

    return null;
};
