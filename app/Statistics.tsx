'use client';

import {
  getTranscriptions,
  storeIsListening,
  storeIsReadyForNew,
  useTranscribeStore,
} from '@/store/transcribe';

export function Statistics() {
  const storeListening = useTranscribeStore(storeIsListening);
  const storeReady = useTranscribeStore(storeIsReadyForNew);
  const transcriptions = useTranscribeStore(getTranscriptions);

  return (
    <>
      {transcriptions.map((transcription) => (
        <div key={transcription.groupId}>
          Group: {transcription.groupId}
          <br />
          Store is Listening: {storeListening ? 'true' : 'false'}
          <br />
          Store is Ready: {storeReady ? 'true' : 'false'}
          <br />
          First started at: {transcription.firstStartedAt?.toLocaleString()}
          <br />
          Last unfinished started at:{' '}
          {transcription.lastStartedTime?.toLocaleDateString()}
          <br />
          Elapsed Completed Time:{' '}
          {transcription.completedTranscriptionTimeMs / 1000}
          <br />
          Full Transcription: {transcription.fullTranscription}
          <br />
          <br />
          Stream Transcription: {transcription.streamTranscription}
        </div>
      ))}
    </>
  );
}
