'use client';

import { setRecordingDisabled, useTranscriptionStore } from '@/store/record';
import {
  newWritingVersion,
  setProcessing,
  useWritingStore,
} from '@/store/writing';
import { emailPrompts } from '@/utils/gpt/prompts';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from '../page.module.scss';

const lorem = `To be, or not to be, that is the question:
Whether 'tis nobler in the mind to suffer
The slings and arrows of outrageous fortune,
Or to take arms against a sea of troubles
And by opposing end them. To die—to sleep,
No more; and by a sleep to say we end
The heart-ache and the thousand natural shocks
That flesh is heir to: 'tis a consummation
Devoutly to be wish'd. To die, to sleep;
To sleep, perchance to dream—ay, there's the rub:
For in that sleep of death what dreams may come,
When we have shuffled off this mortal coil,
Must give us pause—there's the respect
That makes calamity of so long life.
For who would bear the whips and scorns of time,
Th'oppressor's wrong, the proud man's contumely,
The pangs of dispriz'd love, the law's delay,
The insolence of office, and the spurns
That patient merit of th'unworthy takes,
When he himself might his quietus make
With a bare bodkin? Who would fardels bear,`.split(' ');

function WrittenBlock() {
  const [processedWriting, setProcessedWriting] = useState<string>('');
  const [testTokens, setTestTokens] = useState<string[]>([]);

  const { transcriptions, recordingState } = useTranscriptionStore((state) => ({
    transcriptions: state.transcriptions,
    recordingState: state.recordingState,
  }));

  useEffect(() => {
    const interval = setInterval(() => {
      // Push the next word from lorem into testTokens
      setTestTokens((prev) => {
        if (prev.length >= lorem.length) {
          clearInterval(interval);
          console.log('Done');
          return prev;
        }

        return [...prev, lorem[prev.length]];
      });
    }, 750);

    return () => clearInterval(interval);
  }, []);

  const {
    latestWrittenVersion,
    latestWrittenVersionIndex,
    processedUntilTranscriptionIndex,
    processing,
  } = useWritingStore((state) => ({
    latestWrittenVersion: state.processedWritingVersions.length
      ? state.processedWritingVersions[
          state.processedWritingVersions.length - 1
        ]
      : null,
    latestWrittenVersionIndex: state.processedWritingVersions.length - 1,
    processedUntilTranscriptionIndex: state.processedTranscriptionsUntilIndex,
    processing: state.processing,
  }));

  useEffect(() => {
    (async () => {
      if (
        recordingState === 'STOPPED' &&
        transcriptions.length <= processedUntilTranscriptionIndex &&
        !processing
      ) {
        console.log('Re-enabling recording...');
        setRecordingDisabled(false);
      }

      if (
        recordingState === 'STOPPED' &&
        transcriptions.length > processedUntilTranscriptionIndex &&
        !processing
      ) {
        setProcessing(true);

        const transcriptToProcess =
          transcriptions[processedUntilTranscriptionIndex];

        const systemPrompt = !latestWrittenVersion
          ? emailPrompts.createSystemPrompt()
          : emailPrompts.updateSystemPrompt(latestWrittenVersion.text);
        const userPrompt = !latestWrittenVersion
          ? emailPrompts.createUserPrompt(transcriptToProcess.text)
          : emailPrompts.updateUserPrompt(transcriptToProcess.text);

        console.log(
          'WRITING: Processing new transcript: ',
          transcriptToProcess
        );

        console.log('Latest written version exists? ', !!latestWrittenVersion);

        const response = await fetch('/gpt/draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemPrompt,
            userPrompt,
          }),
        });

        if (!response.ok) {
          newWritingVersion(null);
          setProcessing(false);
          console.error('Error - ', response.statusText);
          return;
        }

        const data = response.body;

        if (!data) {
          newWritingVersion(null);
          setProcessing(false);
          console.error('No data returned');
          return;
        }

        const reader = data.getReader();
        const decoder = new TextDecoder();

        let done = false;

        let fullText = '';
        setProcessedWriting(fullText);
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;

          // console.log('Got chunk - ', decoder.decode(value));
          fullText += decoder.decode(value);
          setProcessedWriting(fullText);
        }

        newWritingVersion(fullText);

        setProcessing(false);
      }
    })().catch((err) => {
      console.error('Error processing transcription: ', err);
      newWritingVersion(null);
      setProcessing(false);
    });
  }, [
    latestWrittenVersion,
    processedUntilTranscriptionIndex,
    processing,
    recordingState,
    transcriptions,
  ]);

  return (
    <>
      <div className="px-4 pb-5 pt-4 -mt-2 rounded-t-lg dark:bg-slate-700 bg-slate-300 dark:text-slate-300 text-slate-700">
        {processedWriting}
      </div>
      <div className="px-4 pb-5 pt-4 -mt-2 rounded-t-lg dark:bg-red-400 bg-red-500 text-slate-700">
        {testTokens.map((token, index) => (
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
    </>
  );
}

export default function Writer() {
  return <WrittenBlock />;
}
