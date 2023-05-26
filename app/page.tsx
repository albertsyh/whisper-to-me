import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { findIconDefinition } from '@fortawesome/fontawesome-svg-core';

import styles from './page.module.scss';
import AudioInput from './AudioInput';

import { library } from '@fortawesome/fontawesome-svg-core';
import { fad } from '@fortawesome/pro-duotone-svg-icons';
import ToggleTheme from '@/components/ToggleTheme';

library.add(fad);

const face = findIconDefinition({
  prefix: 'fad',
  iconName: 'face-holding-back-tears',
});

export default function Home() {
  return (
    <main className={styles.main}>
      <div className="p-3">
        <h1 className="text-lg font-bold flex justify-between items-center">
          Transcriber
          <ToggleTheme />
        </h1>
        <p>
          <FontAwesomeIcon icon={face} />
        </p>
        <AudioInput />
      </div>
    </main>
  );
}
