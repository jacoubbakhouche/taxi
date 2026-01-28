export const playSound = (type: 'click' | 'notification' | 'ring' | 'offer') => {
    const sounds = {
        click: '/sounds/click.mp3',
        notification: '/sounds/notification.mp3',
        ring: '/sounds/ring.mp3',
        offer: '/sounds/offer.mp3'
    };

    const audio = new Audio(sounds[type]);
    audio.volume = type === 'click' ? 0.3 : 1.0; // Click is quieter

    if (type === 'ring') {
        audio.loop = true;
    }

    // Play and catch errors (e.g., user didn't interact yet)
    audio.play().catch(e => console.error("Audio play failed:", e));

    return audio; // Return instance to allow stopping (for ringtones)
};
