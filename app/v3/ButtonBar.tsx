'use client';

import useAudioStore from '@/store/audio';
import { useEffect, useState } from 'react';
import { shallow } from 'zustand/shallow';

export default function ButtonBar() {
  // console.log('Button bar rerendered');
  const [timeElapsedStr, setTimeElapsedStr] = useState<string | null>(null);

  const recordingFunctions = useAudioStore((state) => state.recordingFunctions);
  const recordingState = useAudioStore((state) => state.recordingState);

  const { pastRecordingTimeMs, lastStartTime } = useAudioStore(
    (state) => ({
      pastRecordingTimeMs: state.savedRecordingTimeMs,
      lastStartTime: state.recordingStart,
    }),
    shallow
  );

  useEffect(() => {
    if (recordingState === 'RECORDING') {
      const setTime = () => {
        const timeElapsedMs = lastStartTime
          ? new Date().getTime() - lastStartTime.getTime()
          : 0;
        setTimeElapsedStr(
          new Date(timeElapsedMs + pastRecordingTimeMs)
            .toISOString()
            .substring(14, 19)
        );
      };

      setTime();

      const interval = setInterval(setTime, 1000);
      return () => clearInterval(interval);
    }
  }, [recordingState, pastRecordingTimeMs, lastStartTime]);

  return (
    recordingFunctions && (
      <div className="flex justify-end text-xl gap-x-5">
        {(recordingState === 'READY' || recordingState === 'PAUSED') && (
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-indigo-600 pr-3 pl-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={
              recordingState === 'READY'
                ? () => recordingFunctions.startRecording(true)
                : () => recordingFunctions.startRecording(false)
            }
          >
            {recordingState === 'READY' ? 'Start Talking!' : 'Continue!'}
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
        {recordingState === 'RECORDING' && (
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-red-500 pr-3 pl-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={recordingFunctions.pauseRecording}
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
        {(recordingState === 'RECORDING' || recordingState === 'PAUSED') && (
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-emerald-700 pr-3 pl-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => recordingFunctions.stopRecording()}
          >
            Write {timeElapsedStr ? '(' + timeElapsedStr + ')' : ''}
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
        )}
      </div>
    )
  );
}
