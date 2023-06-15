'use client';

import { useEffect } from 'react';
import { MicrophoneIcon, PauseCircleIcon } from '@heroicons/react/24/solid';

import Button from '@/components/Button';
import { useWhisper } from '@albertsyh/use-whisper';
// import { useWhisper } from '../../use-whisper/lib';
import {
  completeJob,
  endTranscription,
  newJob,
  newTranscription,
  storeIsListening,
  storeIsReadyForNew,
  useTranscribeStore,
} from '@/store/transcribe';
import { transcribeWithAPI } from '@/utils/callTranscribeAPI';
import { EndButton } from './EndButton';

export function Recorder() {
  const { startRecording, stopRecording, recording, pauseRecording } =
    useWhisper({
      timeSlice: 500, // seconds
      silenceBufferThreshold: 500,
      removeSilence: true,
      onTranscribe,
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
      if (recording) stopRecording();
    }
  }, [storeListening, recording, startRecording, stopRecording]);

  async function onTranscribe(blob: Blob) {
    // This is just a dummy ontranscribe, nothing actually happens

    return {
      blob,
      text: undefined,
    };
  }

  async function onTranscribeWhenSilent(blob?: Blob, complete?: boolean) {
    console.log(
      'onTranscribeWhenSilent, blob exists? ',
      !!blob,
      'complete? ',
      complete
    );

    // TODO: This isn't whisper-to-me's fault, but use-whisper keeps re-requesting the ffmpeg wasm every time. Almost all the requests are cached, but we need to investigate.

    let transcription = undefined;

    if (blob) {
      const pieceId = newJob('PARTIAL');

      transcription = await transcribeWithAPI(blob);

      completeJob(pieceId, transcription);
    }

    if (complete) {
      newJob('FULL', true);
    }

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
