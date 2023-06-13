import { completeVersion, useWritingStore } from '@/store/write';
import { streamFromChatGPT } from '@/utils/gpt/client/callgpt';
import { motion } from 'framer-motion';
import { useEffect, useState, memo } from 'react';

export const WritingVersion = memo(function WritingVersion({
  versionId,
}: {
  versionId: number;
}) {
  const [started, setStarted] = useState(false);
  const [content, setContent] = useState('');
  const [finished, setFinished] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const versionReadyToStart = useWritingStore((state) =>
    state.versions.find((v) => v.startedAt === versionId)
  );

  useEffect(() => {
    console.log(
      'Version ',
      versionId,
      ' ready to start - ',
      versionReadyToStart
    );

    if (versionReadyToStart && versionReadyToStart?.readyToStart && !started) {
      // Ideally this conditional fires only once, but we'll see
      // If it fires more than once, we might need to limit dependencies

      setStarted(true);
      console.log('Starting...');

      (async () => {
        console.log(
          'Calling chatgpt with ',
          versionReadyToStart.inputText,
          ' and ',
          versionReadyToStart.previousCompletedOutput
        );

        const response = await streamFromChatGPT(
          versionReadyToStart.inputText,
          versionReadyToStart.previousCompletedOutput
        );

        for await (const packet of response) {
          if (packet.type === 'error') {
            console.log('Got error ', packet.errorMessage, ' from chatgpt');
            setErrorMessage(packet.errorMessage);
            break;
          } else if (packet.type === 'partialMessage') {
            setContent(packet.partialMessage);
          } else if (packet.type === 'fullMessage') {
            setContent(packet.message);
            setFinished(true);
            completeVersion(versionReadyToStart.startedAt, packet.message);
            break;
          }
        }
      })().then(() => console.log('Done getting response from chatgpt'));

      // To be done from https://github.dev/albertsyh/whisper-to-me/tree/hrishi/testing-custom
    }
  }, [versionId, versionReadyToStart]);

  return (
    (started && (
      <div
        key={versionId}
        className={' ' + (errorMessage ? 'bg-red-400' : 'bg-slate-500')}
      >
        {content.split(' max-w-md').map((token, index) => (
          <motion.span
            initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ ease: 'easeOut', duration: 0.5 }}
            key={index}
            className="mr-1"
          >
            {token}
          </motion.span>
        ))}
      </div>
    )) ||
    null
  );
});
