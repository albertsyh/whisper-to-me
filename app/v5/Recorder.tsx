'use client';

import { useEffect } from 'react';
import { MicrophoneIcon, PauseCircleIcon } from '@heroicons/react/24/solid';

import Button from '@/components/Button';
import { useWhisper } from '../../../use-whisper/lib';
import {
  completeJob,
  endTranscription,
  newJob,
  newTranscription,
  storeIsListening,
  storeIsReadyForNew,
  useTranscribeStore,
} from '@/store/v2/transcribe';
import { transcribeWithAPI } from '@/utils/transcribe';
import { EndButton } from './EndButton';

export function Recorder() {
  const { startRecording, stopRecording, recording, pauseRecording } =
    useWhisper({
      timeSlice: 500, // seconds
      removeSilence: true,
      onTranscribe,
      silenceBufferThreshold: 500,
      onTranscribeWhenSilent,
    });

  const storeListening = useTranscribeStore(storeIsListening);
  const storeReadyForNewTranscription = useTranscribeStore(storeIsReadyForNew);

  // console.log('Recoder rerendered - ', {
  //   storeListening,
  //   storeReadyForNewTranscription,
  //   recording,
  // });

  useEffect(() => {
    if (storeListening && !recording) {
      console.log('Starting recorder...');
      startRecording();
    } else if (!storeListening && recording) {
      console.log('Stopping recorder...');
      stopRecording();
    }
  }, [storeListening, recording, startRecording, stopRecording]);

  async function onTranscribe(blob: Blob) {
    console.log('onTranscribe...');

    const pieceId = newJob('FULL');

    const transcription = await transcribeWithAPI(blob);

    completeJob(pieceId, transcription);

    return {
      blob,
      text: transcription,
    };
  }

  async function onTranscribeWhenSilent(blob: Blob) {
    console.log('onTranscribeWhenSilent');

    const pieceId = newJob('PARTIAL');

    const transcription = await transcribeWithAPI(blob);

    completeJob(pieceId, transcription);

    return {
      blob,
      text: transcription,
    };
  }

  function start() {
    newTranscription();
  }

  function pause() {
    endTranscription();
  }

  return (
    <div className="fixed md:relative bottom-0 right-0 p-4 w-full flex">
      <div className="flex gap-2 ml-auto">
        {storeReadyForNewTranscription && (
          <Button
            variant="primary"
            onClick={start}
            disabled={!storeReadyForNewTranscription}
          >
            Start <MicrophoneIcon className="h-5 inline" />
          </Button>
        )}
        {storeListening && (
          <Button variant="danger" onClick={pause}>
            Pause <PauseCircleIcon className="h-5 inline" />
          </Button>
        )}
        <EndButton />
      </div>
    </div>
  );
}
