import { useEffect, useRef, useState } from 'react';

import { visualizeFrequencyBars } from '@/utils/draw';
import { useTheme } from 'next-themes';
import styles from './Visualiser.module.scss';
import classNames from 'classnames';

type VisualizerProps = {
  width: number;
  height: number;
};

function Visualizer({ width, height }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const { theme } = useTheme();
  useEffect(() => {
    (async function run() {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      setAnalyser(analyser);
    })();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;
    const run = visualizeFrequencyBars(
      analyser,
      canvasRef.current,
      theme === 'dark' ? '#020617' : '#FFFFFF',
      '#172554'
    );
    return () => {
      run();
    };
  }, [analyser, theme]);

  return (
    <div
      className={classNames(styles.container, {
        [styles.dark]: theme === 'dark',
      })}
    >
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
}

export default Visualizer;
