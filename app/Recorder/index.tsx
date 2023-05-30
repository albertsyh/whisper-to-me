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
// import { useWhisper } from '../../../use-whisper/lib'; // This needs version 2.0.8 from hrishi/streamingonsilence

import Button from '@/components/Button';
import {
  Transcription,
  addStreamingTranscription,
  useTranscriptionStore,
} from '@/store/record';
import Samples from './Samples';
import TranscriptionsBlock from './TranscriptionsBlock';
import HeaderBlock from './HeaderBlock';

function PlaybackTime() {
  const { savedRecordingTimeMs, lastRecordingStart } = useTranscriptionStore(
    (state) => ({
      savedRecordingTimeMs: state.savedRecordingTimeMs,
      lastRecordingStart: state.lastRecordingStart,
    })
  );

  const [playbackTimeStr, setPlaybackTimeStr] = useState<string | null>(null);

  useEffect(() => {
    if (savedRecordingTimeMs || lastRecordingStart) {
      const interval = setInterval(() => {
        const elapsedTime =
          savedRecordingTimeMs +
          (lastRecordingStart
            ? new Date().getTime() - lastRecordingStart.getTime()
            : 0);
        setPlaybackTimeStr(
          new Date(elapsedTime).toISOString().substring(14, 19)
        );
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setPlaybackTimeStr(null);
    }
  }, [savedRecordingTimeMs, lastRecordingStart]);

  return playbackTimeStr ? (
    <span className="mx-1">{playbackTimeStr}</span>
  ) : null;
}

function getStreamingPrompt(
  streamingTranscriptions: { text: string; createdAt: Date }[]
) {
  function getLastNWords(str: string, n: number): string {
    const words = str.split(/\s+/); // Split the string on whitespace
    return words.slice(Math.max(words.length - n, 0)).join(' ');
  }

  return streamingTranscriptions.length
    ? `Continue from here: ${getLastNWords(
        streamingTranscriptions.map((transcript) => transcript.text).join(' '),
        10
      )}`
    : '';
}

function Recorder() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const {
    updateRecordingState,
    recordingState,
    transcriptions,
    updateTranscribingState,
    isTranscribing,
    streamingTranscriptions,
    onTranscribe: onStoreTranscribe,
  } = useTranscriptionStore();

  const streamingTranscriptionsPrompt = useRef(
    getStreamingPrompt(useTranscriptionStore.getState().streamingTranscriptions)
  );

  useEffect(
    () =>
      useTranscriptionStore.subscribe(
        (state) =>
          (streamingTranscriptionsPrompt.current = getStreamingPrompt(
            state.streamingTranscriptions
          ))
      ),
    []
  );

  const onTranscribeWhenSilent = async (blob: Blob) => {
    console.log('Transcribing because we encountered silence...');

    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    const headers = { 'Content-Type': 'application/json' };

    const prompt = streamingTranscriptionsPrompt.current;

    try {
      console.time('Transcribe with Desktop');
      const response = await fetch('/audio/custom', {
        method: 'POST',
        body: JSON.stringify({
          file: base64,
          model: 'small.en',
          prompt,
        }),
        headers,
      });

      const res = await response.json();
      if (res.text) console.log('Custom: ', res.text);
      else console.log('Custom audio route response - ', res);
      if (res.text) addStreamingTranscription(res.text);
      console.timeEnd('Transcribe with Desktop');

      return {
        blob,
        text: res.text,
      };
    } catch (error) {
      console.timeEnd('Transcribe with Desktop');
      console.error('Error testing custom audio route - ', error);

      return {
        blob,
        text: undefined,
      };
    }
  };

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
          console.time('Transcribe with Desktop');
          const response = await fetch('/audio/custom', {
            method: 'POST',
            body: JSON.stringify({
              file: base64,
              model: 'tiny.en',
            }),
            headers,
          });
          console.timeEnd('Transcribe with Desktop');

          const res = await response.json();
          if (res.text) console.log('Custom: ', res.text);
          else console.log('Custom audio route response - ', res);
        } catch (error) {
          console.error('Error testing custom audio route - ', error);
        }
      })();

      try {
        console.time('Transcribe with Whisper');
        const response = await fetch('/audio', {
          method: 'POST',
          body,
          headers,
        });

        console.timeEnd('Transcribe with Whisper');
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
      }
    },
    [updateRecordingState]
  );

  const { startRecording, stopRecording, recording } = useWhisper({
    onTranscribeWhenSilent,
    removeSilence: true,
    onTranscribe,
    timeSlice: 500,
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
    },
    [transcriptions, updateRecordingState]
  );

  const handleStop = useCallback(async () => {
    console.log(
      'Streamed transcriptions - ',
      streamingTranscriptions.map((c) => c.text).join('')
    );

    if (!stream) return;
    stopAudio(stream);
    updateRecordingState('READY');
    if (recording) {
      await stopRecording();
    }
    if (!recording) {
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
      console.log();
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

  return (
    <div>
      <HeaderBlock
        state={recordingState}
        hasTranscription={!!transcriptions.length}
        isTranscribing={isTranscribing}
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
          <Button onClick={handleState} disabled={isTranscribing}>
            <PlaybackTime />
            <ButtonIcon className="h-5 inline" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Recorder;
