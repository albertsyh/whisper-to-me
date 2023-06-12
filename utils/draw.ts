type RGB = {
  r: number;
  g: number;
  b: number;
};

export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function visualizeFrequencyBars(
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement,
  backgroundColor: string,
  strokeColor: string
) {
  const canvasCtx = canvas.getContext('2d')!;
  analyser.fftSize = 1024;
  const { width, height } = canvas;
  const halfWidth = width / 2;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const barWidth = width / bufferLength / 2;
  const barHeightPixel = height / 255 / 3;
  let running = true;
  canvasCtx.clearRect(0, 0, width, height);

  function stop() {
    running = false;
  }

  function draw() {
    if (!running) return;
    analyser.getByteFrequencyData(dataArray);
    requestAnimationFrame(draw);

    canvasCtx.fillStyle = backgroundColor;
    canvasCtx.fillRect(0, 0, width, height);

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] * barHeightPixel;
      const rgb = hexToRgb(strokeColor);
      if (!rgb) return;
      const color = `rgb(${Math.min(
        255,
        Math.round((height - barHeight) * 1.2)
      )}, ${Math.round(((halfWidth + barWidth * i) / width) * 255)}, ${rgb.b})`;
      canvasCtx.fillStyle = color;
      // right side
      canvasCtx.fillRect(
        halfWidth + barWidth * i + 1,
        height / 2 - barHeight,
        barWidth,
        barHeight * 2
      );
      // // left side
      canvasCtx.fillRect(
        halfWidth - barWidth * i + 1,
        height / 2 - barHeight,
        barWidth,
        barHeight * 2
      );
    }
    return stop;
  }

  draw();
  return stop;
}
