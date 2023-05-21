import { Fira_Sans } from 'next/font/google';
import Whisper from './Whisper';
import ButtonBar from './ButtonBar';
import Transcription from './Transcription';

const FiraSans = Fira_Sans({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

export default function Home() {
  console.log('Page rerendered');

  return (
    <main className={FiraSans.className + ' p-6 flex h-screen flex-col gap-5'}>
      <div className="text-2xl font-bold">Version 3, Albert!</div>
      <Transcription />
      <Whisper />
      <ButtonBar />
    </main>
  );
}
