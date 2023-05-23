'use client';

import useAudioStore from '@/store/audio';
import React, { useEffect, useRef } from 'react';

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Color,
} from 'three';

function visualize3D(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  analyser: AnalyserNode
) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Set up three.js scene
  const scene = new Scene();
  const camera = new PerspectiveCamera(90, width / height, 0.1, 1000);
  camera.position.z = 15;
  camera.position.y = 5;
  camera.rotation.x = -0.45;

  const renderer = new WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(width, height);

  // Create an array of materials to use for the bars
  const materials = Array.from(
    { length: bufferLength },
    (_, i) =>
      new MeshBasicMaterial({
        color: new Color(`hsl(${(i / bufferLength) * 360}, 100%, 50%)`),
      })
  );

  // Create an array of geometry/mesh for the bars
  const bars = Array.from({ length: bufferLength }, (_, i) => {
    const geometry = new BoxGeometry(0.5, 0.5, 5);
    const bar = new Mesh(geometry, materials[i]);
    bar.position.x = (i / bufferLength) * 20 - 10; // Spread the bars along the x axis
    scene.add(bar);
    return bar;
  });

  function stop() {
    // Clean up scene when stop is called
    bars.forEach((bar) => scene.remove(bar));
    renderer.dispose();
  }

  function draw() {
    // Fetch the new data
    analyser.getByteFrequencyData(dataArray);
    // Update the scale of the bars to visualize the frequency
    bars.forEach((bar, i) => {
      const h = (dataArray[i] / 255) * 10; // Multiply by 10 for more dramatic heights
      bar.scale.z = h;
      bar.position.y = h / 2; // Move the bar up so it extends down from the original position
    });

    // Render the scene
    renderer.render(scene, camera);

    // Continue looping
    requestAnimationFrame(draw);
  }

  draw();
  return stop;
}

// Visualization functions
const visualizeSineWave = (
  canvasCtx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  backgroundColor: string,
  strokeColor: string,
  analyser: AnalyserNode
): (() => void) => {
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
  three: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  width,
  height,
  backgroundColor,
  strokeColor,
  three,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopVisualizer = useRef<(() => void) | null>(null);
  const recordingState = useAudioStore((state) => state.recordingState);

  useEffect(() => {
    if (three) {
      const canvas = canvasRef.current;

      // Define async function inside useEffect
      const startVisualizer = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        let analyser = audioContext.createAnalyser();
        source.connect(analyser);

        if (canvas) {
          stopVisualizer.current = visualize3D(canvas, width, height, analyser);
        }
      };

      // Call async function
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
    } else {
      const startVisualizer = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(stream);
          let analyser = audioContext.createAnalyser();
          source.connect(analyser);

          if (canvasRef.current) {
            const canvasCtx = canvasRef.current.getContext('2d');
            if (canvasCtx) {
              stopVisualizer.current = visualizeSineWave(
                canvasCtx,
                canvasRef.current,
                width,
                height,
                backgroundColor,
                strokeColor,
                analyser
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
    }
  }, [three, width, height, recordingState, backgroundColor, strokeColor]);

  return <canvas ref={canvasRef} width={width} height={height} />;
};

export default AudioVisualizer;
