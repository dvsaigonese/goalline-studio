export function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

export function addFilmGrain(ctx, width, height, intensity = 0.08) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
        const noise = (Math.random() - 0.5) * intensity * 255;
        pixels[i] = Math.min(255, Math.max(0, pixels[i] + noise));     
        pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + noise)); 
        pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + noise)); 
    }
    ctx.putImageData(imageData, 0, 0);
}