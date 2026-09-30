
function loessSmoothing(data, span) {
    // span should be between 0 and 1, representing the fraction of data points to use
    // We'll convert the slider value (0-10) to a span value (0.05-1.0)
    // When span is 0, return the original data without smoothing
    if (span === 0) {
        return data;
    }

    const alpha = 0.05 + (span / 10) * 0.95;

    const smoothed = [];
    const n = data.length;
    const bandwidth = Math.max(2, Math.floor(alpha * n));

    // Tricube weight function
    const tricube = (x) => {
        const absX = Math.abs(x);
        if (absX >= 1) return 0;
        const tmp = 1 - absX * absX * absX;
        return tmp * tmp * tmp;
    };

    for (let i = 0; i < n; i++) {
        // Find the k nearest neighbors
        const distances = [];
        for (let j = 0; j < n; j++) {
            if (data[j] !== null) {
                distances.push({ index: j, distance: Math.abs(i - j) });
            }
        }

        if (distances.length === 0) {
            smoothed.push(null);
            continue;
        }

        distances.sort((a, b) => a.distance - b.distance);
        const neighbors = distances.slice(0, Math.min(bandwidth, distances.length));

        if (neighbors.length === 0) {
            smoothed.push(data[i]);
            continue;
        }

        const maxDist = neighbors[neighbors.length - 1].distance;

        if (maxDist === 0) {
            smoothed.push(data[i]);
            continue;
        }

        // Weighted linear regression
        let sumW = 0;
        let sumWX = 0;
        let sumWY = 0;
        let sumWXX = 0;
        let sumWXY = 0;

        for (const neighbor of neighbors) {
            const j = neighbor.index;
            const w = tricube(neighbor.distance / maxDist);
            sumW += w;
            sumWX += w * j;
            sumWY += w * data[j];
            sumWXX += w * j * j;
            sumWXY += w * j * data[j];
        }

        // Solve for slope and intercept
        const denominator = sumW * sumWXX - sumWX * sumWX;
        if (Math.abs(denominator) < 1e-10) {
            // Fallback to weighted average if regression fails
            smoothed.push(sumWY / sumW);
        } else {
            const slope = (sumW * sumWXY - sumWX * sumWY) / denominator;
            const intercept = (sumWY - slope * sumWX) / sumW;
            smoothed.push(intercept + slope * i);
        }
    }

    return smoothed;
}

// Test data: a simple noisy sine wave
const y = Array.from({ length: 50 }, (_, i) => Math.sin(i * 0.2) + Math.random() * 0.5);

console.log("Original Y sample:", y.slice(0, 5));
for (let s of [1, 5, 10]) {
    const smoothedY = loessSmoothing(y, s);
    console.log(`Smoothing ${s} (first 5):`, smoothedY.slice(0, 5));
    // Check for NaNs
    const hasNaN = smoothedY.some(v => isNaN(v));
    console.log(`Smoothing ${s} has NaNs:`, hasNaN);
}
