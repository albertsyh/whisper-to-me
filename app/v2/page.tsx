'use client'; // just for now lol

import useWhisper from '@albertsyh/use-whisper';
import styles from './page.module.scss';
import { Lora, Fira_Sans } from 'next/font/google';
import { useCallback, useEffect, useRef, useState } from 'react';

const TRANSCRIPTION_SNIPPET_LENGTH = 200;

const LoraMain = Lora({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

const FiraSans = Fira_Sans({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

type RecordingState = 'NOT_STARTED' | 'RECORDING' | 'PAUSED';

export default function Home() {
  const transcriptHistory = useRef('');
  const [recordingState, setRecordingState] =
    useState<RecordingState>('NOT_STARTED');
  const [displayedTranscriptionSnippet, setDisplayedTranscriptionSnippet] =
    useState<string>('');

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
      console.log('Got full transcription - ', res);

      if (res.text) {
        setDisplayedTranscriptionSnippet(res.text);
      }
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

  const onStreamTranscribe = async (blob: Blob) => {
    console.log('Stream transcription');
    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    const body = JSON.stringify({
      file: base64,
      model: 'whisper-1',
      prompt: transcriptHistory.current,
    });
    const headers = { 'Content-Type': 'application/json' };
    try {
      const response = await fetch('/audio', {
        method: 'POST',
        body,
        headers,
      });

      const res = await response.json();
      if (res.text) {
        console.log('Streamed transcription received - ', res);
        transcriptHistory.current += res.text;
        setDisplayedTranscriptionSnippet(
          (transcriptHistory.current.length > TRANSCRIPTION_SNIPPET_LENGTH
            ? '...'
            : '') +
            transcriptHistory.current.substring(
              0,
              TRANSCRIPTION_SNIPPET_LENGTH
            ) +
            ' (Listening for more...)'
        );
      }
      return {
        blob,
        text: res.text,
      };
    } catch (error) {
      console.log('Failed to stream transcribe', error);
      return {
        blob,
        text: undefined,
      };
    }
  };

  const { startRecording, stopRecording, recording, pauseRecording } =
    useWhisper({
      streaming: true,
      timeSlice: 5_000, // seconds
      removeSilence: true,
      onTranscribe,
      onStreamTranscribe,
      silenceBufferThreshold: 25_000,
    });

  const handleRecording = useCallback(
    (action: 'RECORD' | 'PAUSE' | 'COMPLETE') => {
      if (action === 'RECORD') {
        setRecordingState('RECORDING');
        startRecording();
      } else if (action === 'PAUSE') {
        setRecordingState('PAUSED');
        pauseRecording();
      } else if (action === 'COMPLETE') {
        setRecordingState('NOT_STARTED');
        stopRecording();
      }
    },
    [setRecordingState, startRecording, pauseRecording, stopRecording]
  );

  return (
    <main
      className={styles.main + ' ' + FiraSans.className + ' p-6 flex h-screen'}
    >
      <div className="mainContainer grow ">
        <div
          className={
            'mainMessage ' + LoraMain.className + ' text-2xl leading-15 my-8'
          }
        >
          Hi Cath!
          <br />
          Let's start writing.
        </div>
        <div className="Examples text-gray-500 px-6 py-3 relative">
          <p className={styles.item1}>
            "Write me an email to ... with ... - don't mention ... - make sure
            to ..."
          </p>

          <p className={styles.item2}>
            "Hi John, I'd love to make it to Saturday dinner. Shall we do it
            next week at 2 pm?"
          </p>

          <p className={styles.item3}>
            "I need a very casual email asking my friend Donna to lunch next
            week, keep it short."
          </p>
        </div>
      </div>
      <div className="footer flex flex-col grow-0 gap-y-5">
        <div className="transcriptContainer px-10">
          {displayedTranscriptionSnippet || 'Listening...'}
        </div>
        <div className="buttonContainer flex justify-end text-xl gap-x-5">
          {recordingState === 'RECORDING' && (
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-red-500 pr-3 pl-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              onClick={() => handleRecording('PAUSE')}
            >
              Pause
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 ml-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-emerald-700 pr-3 pl-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => handleRecording('COMPLETE')}
          >
            Write
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 ml-2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
          {recordingState === 'NOT_STARTED' && (
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-indigo-600 pr-3 pl-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              onClick={() => handleRecording('RECORD')}
            >
              Start Talking!
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 ml-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
