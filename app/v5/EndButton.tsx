import Button from '@/components/Button';
import {
  useTranscribeStore,
  storeIsListening,
  TranscribeStoreState,
  getTranscriptionForGroup,
  endTranscription,
  newGroup,
} from '@/store/v2/transcribe';
import { StopCircleIcon } from '@heroicons/react/24/solid';
import { useState, useEffect } from 'react';

function formatTranscriptionTime(
  lastStartedTranscriptionTime: Date | null,
  completedTranscriptionTimeMs: number
): string {
  if (lastStartedTranscriptionTime === null) {
    return '0:00'; // Return default value if no transcription has started
  }

  const now = new Date();
  const totalTimeMs =
    completedTranscriptionTimeMs +
    (now.getTime() - lastStartedTranscriptionTime.getTime());
  const minutes = Math.floor(totalTimeMs / 60000);
  const seconds = Math.floor((totalTimeMs % 60000) / 1000);
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  return formattedTime;
}

export function EndButton() {
  const storeListening = useTranscribeStore(storeIsListening);
  const {
    lastStartedTranscriptionTime,
    completedTranscriptionTimeMs,
    transcriptionHasData,
  } = useTranscribeStore((store: TranscribeStoreState) => {
    const transcription = getTranscriptionForGroup(
      store,
      store.currentTranscriptionGroup
    );

    return {
      lastStartedTranscriptionTime: transcription?.lastStartedTime,
      completedTranscriptionTimeMs:
        transcription?.completedTranscriptionTimeMs || 0,
      transcriptionHasData:
        transcription?.pendingJobs > 0 ||
        !!transcription.streamTranscription ||
        false,
    };
  });

  const [timeStr, setTimeStr] = useState<string>(
    formatTranscriptionTime(
      lastStartedTranscriptionTime,
      completedTranscriptionTimeMs
    )
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeStr(
        formatTranscriptionTime(
          lastStartedTranscriptionTime,
          completedTranscriptionTimeMs
        )
      );
    }, 250);

    return () => clearInterval(interval);
  }, [lastStartedTranscriptionTime, completedTranscriptionTimeMs]);

  function end() {
    endTranscription();
    newGroup();
  }

  return (
    ((storeListening || transcriptionHasData) && (
      <Button variant="danger" onClick={end}>
        {timeStr} End <StopCircleIcon className="h-5 inline" />
      </Button>
    )) ||
    null
  );
}
