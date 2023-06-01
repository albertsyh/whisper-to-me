'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useWhisper } from '@albertsyh/use-whisper';

import {
  Transcription,
  updateRecordingState,
  updateStoreOnTranscribe,
  useRecordingStore,
} from '@/store/record';
import Samples from './Samples';
import TranscriptionsBlock from './TranscriptionsBlock';
import HeaderBlock from './HeaderBlock';
import Visualizer from '@/components/Visualiser';
import RecordingFooter from './Recording/Footer';

function Recorder() {
  const analyserRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [stage, setStage] = useState<'RECORD_BASE' | 'EDIT_EMAIL'>(
    'RECORD_BASE'
  );
  const [timeElapsedStr, setTimeElapsedStr] = useState<string | null>(null);

  // TODO: Probably replace this with writing store, or .. something
  const [gptProcessed, setGptProcessed] = useState<string>('');

  const { recordingState, lastStartTime, savedRecordingTimeMs } =
    useRecordingStore(
      ({ recordingState, lastStartTime, savedRecordingTimeMs }) => ({
        recordingState,
        lastStartTime,
        savedRecordingTimeMs,
      })
    );

  const onTranscribe = useCallback(async (blob: Blob) => {
    console.log('Transcribing');
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

    // TODO: Remove and integrate later
    // (async function testCustomAudioRoute() {
    //   try {
    //     const response = await fetch('/audio/custom', {
    //       method: 'POST',
    //       body: JSON.stringify({
    //         file: base64,
    //         model: 'base.en',
    //       }),
    //       headers,
    //     });

    //     const res = await response.json();
    //     if (res.text) console.log('Custom: ', res.text);
    //     else console.log('Custom audio route response - ', res);
    //   } catch (error) {
    //     console.error('Error testing custom audio route - ', error);
    //   }
    // })();

    try {
      const response = await fetch('/audio', {
        method: 'POST',
        body,
        headers,
      });

      const res = await response.json();

      if (res.text) console.log('Whisper: ', res.text);
      else console.log('Whisper response - ', res);

      updateStoreOnTranscribe(res.text);
      return {
        blob,
        text: res.text,
      };
    } catch (error) {
      console.log('Failed to transcribe', error);
      updateStoreOnTranscribe('');
      return {
        blob,
        text: undefined,
      };
    }
  }, []);

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
            setStream(stream);
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

  // Remove and stop audio recording on browser
  // i.e. Red dot appearing on browser tab
  const stopAudio = useCallback(
    (hasStream?: MediaStream, isInit?: boolean) => {
      const useStream = hasStream || stream;
      if (!useStream) return;
      useStream.getAudioTracks().forEach((track) => {
        track.stop();
        useStream.removeTrack(track);
      });
      if (isInit) {
        updateRecordingState('READY');
      }
    },
    [stream]
  );

  const { startRecording, stopRecording, recording } = useWhisper({
    removeSilence: true,
    onTranscribe,
    silenceBufferThreshold: 25_000,
  });

  const processGpt = useCallback(async (transcription: Transcription) => {
    setStage('EDIT_EMAIL');
    const response = await fetch('/gpt/draft', {
      method: 'POST',
      body: JSON.stringify({
        transcription: transcription.text,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) console.error('Error - ', response.statusText);

    const data = response.body;

    if (!data) {
      console.error('No data returned');
      return;
    }
    const reader = data.getReader();
    const decoder = new TextDecoder();

    let done = false;
    let streamedData = '';
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;

      // console.log('Got chunk - ', decoder.decode(value));
      streamedData += decoder.decode(value);
      setGptProcessed(streamedData);
    }
    updateRecordingState('READY');
  }, []);

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
      <HeaderBlock />
      <div className="relative" style={{ minHeight: '50vh' }}>
        {!started && <Samples />}
        {/* TODO: Combine audio transcriptions from base recording and email text edits */}
        {started && <TranscriptionsBlock />}
        {gptProcessed && (
          <div className="px-1 py-4">
            <div className="font-bold">Email</div>
            {gptProcessed}
          </div>
        )}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 bottom-0 z-10"
          ref={analyserRef}
        >
          {recordingState === 'RECORDING' && recording && (
            <Visualizer width={width} height={height} />
          )}
        </div>
      </div>
      {stage === 'RECORD_BASE' && (
        <RecordingFooter
          onStartGpt={processGpt}
          timeElapsedStr={timeElapsedStr}
          setTimeElapsedStr={setTimeElapsedStr}
          startAudio={startAudio}
          stopAudio={stopAudio}
          startRecording={startRecording}
          stopRecording={stopRecording}
        />
      )}
      {/* TODO: Footer to handle gpt emails and gpt email edit audio transcriptions */}
      {stage === 'EDIT_EMAIL' && <div>Buttons here..</div>}
    </div>
  );
}

export default Recorder;
