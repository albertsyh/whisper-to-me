'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fad } from '@fortawesome/pro-duotone-svg-icons';

import Button from '@/components/Button';
import { useTranscriptionStore } from '@/store/record';
import { useWhisper } from '@albertsyh/use-whisper';
import { generateIcon } from '@/utils/icons';

library.add(fad);

const EXAMPLES = [
  'Write me an email to .... with .... - don’t mention ..... - make sure to',
  'Hi John, I’d love to make it to Saturday dinner. Shall we do it next week at 2 pm?',
  'I need a very casual email asking my friend Donna to lunch next week, make it short.',
];

function Recorder() {
  const audioContextRef = useRef<AudioContext>(new AudioContext());
  const [started, setStarted] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { updateRecordingState, recordingState } = useTranscriptionStore();

  const onTranscribe = async (blob: Blob) => {
    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
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
      setTranscript(res.text);
      return {
        blob,
        text: res.text,
      };
    } catch (error) {
      console.log('Failed to transcribe', error);
      return {
        blob,
        text: undefined,
      };
    }
  };

  useEffect(() => {
    startAudio().then((stream) => stopAudio(stream, true));
  }, []); // eslint-disable-line

  const startAudio = useCallback(
    async function (isStart?: boolean): Promise<MediaStream> {
      return new Promise((resolve, reject) => {
        if ('mediaDevices' in navigator) {
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
              const source =
                audioContextRef.current.createMediaStreamSource(stream);
              const analyser = audioContextRef.current.createAnalyser();
              source.connect(analyser);
              setAnalyser(analyser);
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
        updateRecordingState('STOPPED');
      }
    },
    [updateRecordingState]
  );

  const { startRecording, pauseRecording, stopRecording, recording } =
    useWhisper({
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
      <h2 className="text-2xl py-10">
        {`Hi Cath, let's start `}
        <span className="font-bold mr-3">writing</span>
        <FontAwesomeIcon icon={generateIcon('feather')} />
      </h2>
      {!started && (
        <div className="py-10">
          {EXAMPLES.map((o) => (
            <div key={o} className="py-5">
              {o} <hr />
            </div>
          ))}
        </div>
      )}
      {started && <div className="py-10">{transcript}</div>}
      <div className="fixed md:relative bottom-0 right-0 p-4 w-full flex">
        <div className="flex gap-2 ml-auto">
          {recordingState &&
            ['RECORDING', 'PAUSED'].includes(recordingState) && (
              <Button variant="danger" onClick={handleStop}>
                Stop <FontAwesomeIcon icon={generateIcon('circle-stop')} />
              </Button>
            )}
          <Button onClick={handleState}>
            {(!recordingState ||
              ['STOPPED', 'READY'].includes(recordingState)) && (
              <FontAwesomeIcon icon={generateIcon('microphone')} />
            )}
            {recordingState === 'RECORDING' && (
              <FontAwesomeIcon icon={generateIcon('pause-circle')} />
            )}
            {recordingState === 'PAUSED' && (
              <FontAwesomeIcon icon={generateIcon('play-circle')} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Recorder;
