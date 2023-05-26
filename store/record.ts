'use client';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type RECORD_STATE = 'READY' | 'RECORDING' | 'PAUSED' | 'STOPPED' | null;
export type TranscriptionStore = {
  recordingState: RECORD_STATE;
  updateRecordingState: (state: RECORD_STATE) => void;
};

export const useTranscriptionStore = create<TranscriptionStore>()(
  devtools(
    (set, get) => ({
      recordingState: null,
      updateRecordingState: (state: RECORD_STATE) =>
        set({ recordingState: state }),
    }),
    { name: 'transcriptionStore', trace: true, serialize: { options: true } }
  )
);
