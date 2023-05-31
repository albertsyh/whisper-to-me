import Recorder from './Recorder';
import Writer from './Writer';
import styles from './page.module.scss';

import ToggleTheme from '@/components/ToggleTheme';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className="p-3 h-full max-w-screen-lg mx-auto w-full">
        <h1 className="text-lg font-bold flex justify-between items-center h-11">
          <span className="uppercase">Transcriber</span>
          <ToggleTheme />
        </h1>
        <div className="flex h-full flex-col" style={{ minHeight: '50vh' }}>
          <Recorder />
        </div>
        <div className="flex h-full flex-col" style={{ minHeight: '50vh' }}>
          <Writer />
        </div>
      </div>
    </main>
  );
}
