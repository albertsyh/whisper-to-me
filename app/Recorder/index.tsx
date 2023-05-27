'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChatBubbleOvalLeftEllipsisIcon,
  MicrophoneIcon,
  PauseCircleIcon,
  PencilIcon,
  PlayCircleIcon,
  StopCircleIcon,
} from '@heroicons/react/24/solid';

import Button from '@/components/Button';
import { useTranscriptionStore } from '@/store/record';
import { useWhisper } from '@albertsyh/use-whisper';
import Samples from './Samples';
import TranscriptionsBlock from './TranscriptionsBlock';
import HeaderBlock from './HeaderBlock';

function Recorder() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const {
    updateRecordingState,
    recordingState,
    saveTranscription,
    transcriptions,
  } = useTranscriptionStore();

  const onTranscribe = useCallback(
    async (blob: Blob) => {
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
      try {
        const response = await fetch('/audio', {
          method: 'POST',
          body,
          headers,
        });

        const res = await response.json();
        updateRecordingState('STOPPED');
        saveTranscription(res.text);
        return {
          blob,
          text: res.text,
        };
      } catch (error) {
        console.log('Failed to transcribe', error);
        updateRecordingState('STOPPED');
        return {
          blob,
          text: undefined,
        };
      }
    },
    [updateRecordingState, saveTranscription]
  );

  useEffect(() => {
    if ('AudioContext' in window) {
      audioContextRef.current = new AudioContext();
    }
    startAudio().then((stream) => stopAudio(stream, true));
  }, []); // eslint-disable-line

  const startAudio = useCallback(
    async function (isStart?: boolean): Promise<MediaStream> {
      return new Promise((resolve, reject) => {
        if ('mediaDevices' in navigator) {
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
              if (audioContextRef.current) {
                const source =
                  audioContextRef.current.createMediaStreamSource(stream);
                const analyser = audioContextRef.current.createAnalyser();
                source.connect(analyser);
                setAnalyser(analyser);
              }
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
    [audioContextRef, setAnalyser]
  );

  const stopAudio = useCallback(
    (stream: MediaStream, isInit?: boolean) => {
      stream.getAudioTracks().forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });
      if (isInit) {
        updateRecordingState('READY');
      } else {
        updateRecordingState('TRANSCRIBING');
      }
    },
    [updateRecordingState]
  );

  const { startRecording, pauseRecording, stopRecording } = useWhisper({
    removeSilence: true,
    onTranscribe,
    silenceBufferThreshold: 25_000,
  });

  const handleState = useCallback(async () => {
    if (!recordingState) {
      const audioStream = await startAudio();
      stopAudio(audioStream, true);
    } else if (['READY', 'STOPPED'].includes(recordingState)) {
      const audioStream = await startAudio(true);
      setStream(audioStream);
      startRecording();
      updateRecordingState('RECORDING');
    } else if (recordingState === 'RECORDING') {
      pauseRecording();
      updateRecordingState('PAUSED');
    } else if (recordingState === 'PAUSED') {
      startRecording();
      updateRecordingState('RECORDING');
    }
  }, [
    recordingState,
    startAudio,
    startRecording,
    pauseRecording,
    stopAudio,
    updateRecordingState,
  ]);

  const handleStop = useCallback(async () => {
    if (!stream) return;
    stopAudio(stream);
    await stopRecording();
  }, [stopAudio, stopRecording, stream]);

  return (
    <div>
      <HeaderBlock
        state={recordingState}
        hasTranscription={!!transcriptions.length}
      />
      {!started && <Samples />}
      {started && <TranscriptionsBlock transcriptions={transcriptions} />}

      <div className="fixed md:relative bottom-0 right-0 p-4 w-full flex">
        <div className="flex gap-2 ml-auto">
          {recordingState &&
            ['RECORDING', 'PAUSED'].includes(recordingState) && (
              <Button variant="danger" onClick={handleStop}>
                Stop <StopCircleIcon className="h-5 inline" />
              </Button>
            )}
          <Button
            onClick={handleState}
            disabled={recordingState === 'TRANSCRIBING'}
          >
            {(!recordingState ||
              ['STOPPED', 'READY'].includes(recordingState)) && (
              <MicrophoneIcon className="h-5 inline" />
            )}
            {recordingState === 'RECORDING' && (
              <PauseCircleIcon className="h-5 inline" />
            )}
            {recordingState === 'PAUSED' && (
              <PlayCircleIcon className="h-5 inline" />
            )}
            {recordingState === 'TRANSCRIBING' && (
              <ChatBubbleOvalLeftEllipsisIcon className="h-5 inline" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Recorder;
