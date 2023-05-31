'use client';

import { setRecordingDisabled, useTranscriptionStore } from '@/store/record';
import {
  newWritingVersion,
  setProcessing,
  useWritingStore,
} from '@/store/writing';
import { emailPrompts } from '@/utils/gpt/prompts';
import { useEffect, useState } from 'react';

function WrittenBlock() {
  const [processedWriting, setProcessedWriting] = useState<string>('');

  const { transcriptions, recordingState } = useTranscriptionStore((state) => ({
    transcriptions: state.transcriptions,
    recordingState: state.recordingState,
  }));

  const { latestWrittenVersion, processedUntilTranscriptionIndex, processing } =
    useWritingStore((state) => ({
      latestWrittenVersion: state.processedWritingVersions.length
        ? state.processedWritingVersions[
            state.processedWritingVersions.length - 1
          ]
        : null,
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
    <div className="px-4 pb-5 pt-4 -mt-2 rounded-t-lg dark:bg-slate-700 bg-slate-300 dark:text-slate-300 text-slate-700">
      {processedWriting}
    </div>
  );
}

export default function Writer() {
  return <WrittenBlock />;
}
