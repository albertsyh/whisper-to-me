'use client';

import useAudioStore from '@/store/audio';
import React, { useEffect, useRef } from 'react';

// Set up audio context and analyser
const audioCtx = new (window.AudioContext ||
  (window as any).webkitAudioContext)();
let analyser = audioCtx.createAnalyser();

// Set up VisualizerContext
const VisualizerContext = {
  getVisualizerContext: () => audioCtx,
  getAnalyser: () => analyser,
  resetAnalyser: () => {
    analyser = audioCtx.createAnalyser();
  },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Visualization functions
const visualizeSineWave = (
  canvasCtx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  backgroundColor: string,
  strokeColor: string
): (() => void) => {
  let analyser = VisualizerContext.getAnalyser();

  let running = true;

  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  canvasCtx.clearRect(0, 0, width, height);

  const stop = () => {
    running = false;
  };

  const draw = () => {
    if (!running) return;
    requestAnimationFrame(draw);

    analyser = VisualizerContext.getAnalyser();

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = backgroundColor;
    canvasCtx.fillRect(0, 0, width, height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = strokeColor;

    canvasCtx.beginPath();

    const sliceWidth = (width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  };

  draw();
  return stop;
};

// React component
interface AudioVisualizerProps {
  width: number;
  height: number;
  backgroundColor: string;
  strokeColor: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  width,
  height,
  backgroundColor,
  strokeColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopVisualizer = useRef<(() => void) | null>(null);
  const recordingState = useAudioStore((state) => state.recordingState);

  useEffect(() => {
    const startVisualizer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        VisualizerContext.getVisualizerContext = () => audioContext;
        VisualizerContext.getAnalyser = () => analyser;

        if (canvasRef.current) {
          const canvasCtx = canvasRef.current.getContext('2d');
          if (canvasCtx) {
            stopVisualizer.current = visualizeSineWave(
              canvasCtx,
              canvasRef.current,
              width,
              height,
              backgroundColor,
              strokeColor
            );
          }
        }
      } catch (error) {
        console.error('Error starting visualizer:', error);
      }
    };

    if (recordingState === 'RECORDING') {
      startVisualizer();
    } else {
      if (stopVisualizer.current) {
        stopVisualizer.current();
      }
    }

    return () => {
      if (stopVisualizer.current) {
        stopVisualizer.current();
      }
    };
  }, [backgroundColor, height, recordingState, strokeColor, width]);

  return <canvas ref={canvasRef} width={width} height={height} />;
};

export default AudioVisualizer;
