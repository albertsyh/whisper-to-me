import { Fira_Sans } from 'next/font/google';
import ButtonBar from './ButtonBar';
import Transcription from './Transcription';
import AudioVisualizer from './Visualizer/VisualizerBig';

const FiraSans = Fira_Sans({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

export default function Home() {
  return (
    <main className={FiraSans.className + ' p-6 flex h-screen flex-col gap-5'}>
      <div className="text-2xl font-bold">Version 3, Albert!</div>
      <div className="flex justify-center">
        <div style={{ width: '500px', height: '100px' }}>
          <AudioVisualizer
            width={500}
            height={100}
            three={true}
            backgroundColor="#000"
            strokeColor="#fff"
          />
        </div>
        <div style={{ width: '500px', height: '100px' }}>
          <AudioVisualizer
            width={500}
            height={100}
            three={false}
            backgroundColor="#000"
            strokeColor="#fff"
          />
        </div>
      </div>
      <Transcription />
      <ButtonBar />
    </main>
  );
}
