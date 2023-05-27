'use client';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type RECORD_STATE =
  | 'READY'
  | 'RECORDING'
  | 'PAUSED'
  | 'STOPPED'
  | 'TRANSCRIBING'
  | null;

export type Transcription = {
  createdAt: string;
  text: string;
  id: number;
};

export type TranscriptionStore = {
  id: number;
  recordingState: RECORD_STATE;
  transcriptions: Transcription[];
  updateRecordingState: (state: RECORD_STATE) => void;
  saveTranscription: (text: string) => void;
};

export const useTranscriptionStore = create<TranscriptionStore>()(
  devtools(
    (set, get) => ({
      id: 0,
      recordingState: null,
      transcriptions: [],
      saveTranscription: (text: string) => {
        if (!text) return;
        const currentIdx = get().id;
        const current = get().transcriptions[currentIdx];
        if (current) {
          set({
            transcriptions: [
              ...get().transcriptions.slice(0, currentIdx),
              { ...current, text },
              ...get().transcriptions.slice(currentIdx + 1),
            ],
          });
        } else {
          set({
            transcriptions: [
              ...get().transcriptions,
              {
                createdAt: new Date().toISOString(),
                text,
                id: currentIdx,
              },
            ],
          });
        }
      },
      updateRecordingState: (state: RECORD_STATE) => {
        set({ recordingState: state });
        if (state === 'STOPPED') set({ id: get().id + 1 });
      },
    }),
    { name: 'transcriptionStore', trace: true, serialize: { options: true } }
  )
);
