'use client';

import React, { useEffect, useRef } from 'react';
import {
  VisualizerContext,
  visualizeSineWave,
  visualizeFrequencyBars,
  visualizeFrequencyCircles,
} from './visualizemath'; // Path to your visualizer file

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

  useEffect(() => {
    const startVisualizer = async () => {
      try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        // Create an audio context and attach it to the microphone stream
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);

        // Attach the analyser to the VisualizerContext
        VisualizerContext.getVisualizerContext = () => audioContext;
        VisualizerContext.getAnalyser = () => analyser;

        // Start the visualizer
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
            // To visualize frequency bars instead, use the following line:
            // stopVisualizer.current = visualizeFrequencyBars(canvasCtx, canvasRef.current, width, height, backgroundColor, strokeColor);
            // And for frequency circles, use this line:
            // stopVisualizer.current = visualizeFrequencyCircles(canvasCtx, canvasRef.current, width, height, backgroundColor, strokeColor);
          }
        }
      } catch (error) {
        console.error('Error starting visualizer:', error);
      }
    };

    startVisualizer();

    // Cleanup function to stop the visualizer when the component unmounts
    return () => {
      if (stopVisualizer.current) {
        stopVisualizer.current();
      }
    };
  }, [width, height, backgroundColor, strokeColor]);

  return <canvas ref={canvasRef} width={width} height={height} />;
};

export default AudioVisualizer;
