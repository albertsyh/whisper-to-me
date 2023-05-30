'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChatBubbleOvalLeftEllipsisIcon,
  MicrophoneIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
} from '@heroicons/react/24/solid';
import { useWhisper } from '@albertsyh/use-whisper';

import Button from '@/components/Button';
import { Transcription, useTranscriptionStore } from '@/store/record';
import Samples from './Samples';
import TranscriptionsBlock from './TranscriptionsBlock';
import HeaderBlock from './HeaderBlock';
import Visualizer from '@/components/Visualiser';

function Recorder() {
  const analyserRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [timeElapsedStr, setTimeElapsedStr] = useState<string | null>(null);

  const {
    updateRecordingState,
    recordingState,
    transcriptions,
    updateTranscribingState,
    isTranscribing,
    onTranscribe: onStoreTranscribe,
    lastStartTime,
    savedRecordingTimeMs,
  } = useTranscriptionStore();

  const onTranscribe = useCallback(
    async (blob: Blob) => {
      console.log('Transcribing');
      const base64 = await new Promise<string | ArrayBuffer | null>(
        (resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }
      );
      const body = JSON.stringify({
        file: base64,
        model: 'whisper-1',
      });
      const headers = { 'Content-Type': 'application/json' };

      // TODO: Remove and integrate later
      (async function testCustomAudioRoute() {
        try {
          const response = await fetch('/audio/custom', {
            method: 'POST',
            body: JSON.stringify({
              file: base64,
              model: 'base.en',
            }),
            headers,
          });

          const res = await response.json();
          if (res.text) console.log('Custom: ', res.text);
          else console.log('Custom audio route response - ', res);
        } catch (error) {
          console.error('Error testing custom audio route - ', error);
        }
      })();

      try {
        const response = await fetch('/audio', {
          method: 'POST',
          body,
          headers,
        });

        const res = await response.json();

        if (res.text) console.log('Whisper: ', res.text);
        else console.log('Whisper response - ', res);

        onStoreTranscribe(res.text);
        return {
          blob,
          text: res.text,
        };
      } catch (error) {
        console.log('Failed to transcribe', error);
        onStoreTranscribe('');
        return {
          blob,
          text: undefined,
        };
      }
    },
    [onStoreTranscribe]
  );

  useEffect(() => {
    startAudio().then((stream) => stopAudio(stream, true));
  }, []); // eslint-disable-line

  const startAudio = useCallback(async function (
    isStart?: boolean
  ): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
      if ('mediaDevices' in navigator) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            if (isStart) setStarted(true);
            resolve(stream);
          })
          .catch((error) => {
            console.error('Microphone access denied:', error);
            reject();
          });
      }
    });
  },
  []);

  const stopAudio = useCallback(
    (stream: MediaStream, isInit?: boolean) => {
      stream.getAudioTracks().forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });
      if (isInit) {
        updateRecordingState('READY');
      }
    },
    [updateRecordingState]
  );

  const { startRecording, stopRecording, recording } = useWhisper({
    removeSilence: true,
    onTranscribe,
    silenceBufferThreshold: 25_000,
  });

  const handleState = useCallback(async () => {
    if (!recordingState) {
      // Initialisation when mic permissions has not been granted
      const audioStream = await startAudio();
      stopAudio(audioStream, true);
    } else if (['READY', 'STOPPED'].includes(recordingState)) {
      const audioStream = await startAudio(true);
      setStream(audioStream);
      startRecording();
      updateRecordingState('RECORDING');
    } else if (recordingState === 'RECORDING') {
      stopRecording();
      updateRecordingState('PAUSED');
      updateTranscribingState(true);
    } else if (recordingState === 'PAUSED') {
      startRecording();
      updateRecordingState('RECORDING');
    }
  }, [
    recordingState,
    startAudio,
    startRecording,
    stopAudio,
    updateRecordingState,
    updateTranscribingState,
    stopRecording,
  ]);

  const processGpt = useCallback(
    async (transcription?: Transcription) => {
      let processThisTranscription: Transcription | undefined = transcription;
      if (!transcription) {
        processThisTranscription = transcriptions[transcriptions.length - 1];
      }
      updateRecordingState('READY');
    },
    [transcriptions, updateRecordingState]
  );

  const handleStop = useCallback(async () => {
    if (!stream) return;
    if (recording) {
      await stopRecording();
    }
    stopAudio(stream);
    if (!recording) {
      setTimeElapsedStr('');
      processGpt();
    }
  }, [stopAudio, stopRecording, stream, recording, processGpt]);

  useEffect(() => {
    const unsub = useTranscriptionStore.subscribe(
      (state) => ({
        recordingState: state.recordingState,
        transcription: state.transcriptions[state.transcriptions.length - 1],
      }),
      (state: any) => {
        if (state.recordingState === 'STOPPED') {
          // Process GPT
          processGpt(state.transcription);
        }
      }
    );

    return () => {
      unsub();
    };
  }, []); // eslint-disable-line

  const ButtonIcon = useMemo(() => {
    if (isTranscribing) return ChatBubbleOvalLeftEllipsisIcon;
    if (!recordingState || ['STOPPED', 'READY'].includes(recordingState))
      return MicrophoneIcon;
    if (recordingState === 'RECORDING') return PauseCircleIcon;
    return PlayCircleIcon;
  }, [recordingState, isTranscribing]);

  useEffect(() => {
    if (recordingState === 'RECORDING') {
      const setTime = () => {
        const timeElapsedMs = lastStartTime
          ? new Date().getTime() - lastStartTime.getTime()
          : 0;
        setTimeElapsedStr(
          new Date(timeElapsedMs + savedRecordingTimeMs)
            .toISOString()
            .substring(14, 19)
        );
      };

      setTime();

      const interval = setInterval(setTime, 1000);
      return () => clearInterval(interval);
    }
  }, [recordingState, lastStartTime, savedRecordingTimeMs]);

  const { width, height } = analyserRef.current?.getBoundingClientRect() || {
    width: 0,
    height: 0,
  };

  return (
    <div>
      <HeaderBlock
        state={recordingState}
        hasTranscription={!!transcriptions.length}
        isTranscribing={isTranscribing}
      />
      <div className="relative" style={{ minHeight: '50vh' }}>
        {!started && <Samples />}
        {started && <TranscriptionsBlock transcriptions={transcriptions} />}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 bottom-0 z-10"
          ref={analyserRef}
        >
          {recordingState === 'RECORDING' && recording && (
            <Visualizer width={width} height={height} />
          )}
        </div>
      </div>

      <div className="fixed md:relative bottom-0 right-0 p-4 w-full flex">
        <div className="flex gap-2 ml-auto">
          {recordingState &&
            ['RECORDING', 'PAUSED'].includes(recordingState) && (
              <Button variant="danger" onClick={handleStop}>
                Stop <StopCircleIcon className="h-5 inline" />
              </Button>
            )}
          <Button onClick={handleState} disabled={isTranscribing}>
            {timeElapsedStr && <span className="mr-2">{timeElapsedStr}</span>}
            <ButtonIcon className="h-5 inline" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Recorder;
