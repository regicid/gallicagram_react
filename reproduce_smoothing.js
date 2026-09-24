
function movingSum(data, windowSize) {
    if (windowSize === 0) {
        return data;
    }
    const smoothed = [];
    const halfWindow = Math.floor(windowSize / 2);
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - halfWindow);
        const end = Math.min(data.length - 1, i + halfWindow);
        let sum = 0;
        let count = 0;
        for (let j = start; j <= end; j++) {
            // In App.js: if (data[j] !== null && data[j] !== undefined)
            if (data[j] !== null && data[j] !== undefined) {
                sum += data[j];
                count++;
            }
        }
        if (count > 0) {
            smoothed.push(sum);
        } else {
            smoothed.push(null);
        }
    }
    return smoothed;
}

// Test data: a simple spike
const n = [10, 10, 10, 100, 10, 10, 10];
const total = [100, 100, 100, 100, 100, 100, 100];

console.log("Original N:", n);
for (let s = 0; s <= 5; s++) {
    const smoothedN = movingSum(n, s);
    console.log(`Smoothing ${s}:`, smoothedN);
}
