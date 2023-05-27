import { AnimatePresence, motion } from 'framer-motion';
import classNames from 'classnames';
import { Transcription } from '@/store/record';

function TranscriptionsBlock({
  transcriptions,
}: {
  transcriptions: Transcription[];
}) {
  return (
    <ul
      className="relative flex flex-col -ml-3 -mr-3 overflow-auto"
      style={{
        maxHeight: 'calc(100vh - 44px - 112px - 24px)', //44px - 112px - 72px
      }}
    >
      <AnimatePresence>
        {transcriptions.map((transcription, index) => (
          <motion.li
            className={classNames('px-4 pb-5 pt-4 -mt-2 rounded-t-lg', {
              ['dark:bg-gray-950 bg-gray-50']: index % 2 === 0,
              ['dark:bg-slate-700 bg-slate-300 dark:text-slate-300 text-slate-700']: index % 2 === 1,
            })}
            key={transcription.id}
            animate={{
              left: 0,
              opacity: 1,
              transition: {
                delay: 0.2 * index,
              },
            }}
            initial={{ left: -10, opacity: 0 }}
            exit={{ left: -10, opacity: 0 }}
          >
            {transcription.text}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export default TranscriptionsBlock;
