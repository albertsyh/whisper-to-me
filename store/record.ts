'use client';
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

export type RECORD_STATE = 'READY' | 'RECORDING' | 'PAUSED' | 'STOPPED' | null;

export type Transcription = {
  createdAt: string;
  text: string;
  id: number;
  isEmpty?: boolean;
};

export type TranscriptionStore = {
  id: number;
  recordingState: RECORD_STATE;
  isTranscribing: boolean;
  transcriptions: Transcription[];
  updateRecordingState: (state: RECORD_STATE) => void;
  updateTranscribingState: (state: boolean) => void;
  onTranscribe: (text: string) => void;
  lastStartTime: Date | null;
  savedRecordingTimeMs: number;
};

export const useTranscriptionStore = create<TranscriptionStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      id: 0,
      recordingState: null,
      isTranscribing: false,
      transcriptions: [],
      lastStartTime: null,
      savedRecordingTimeMs: 0,
      onTranscribe: (text: string) => {
        const currentState = get().recordingState;
        const id = get().id!;
        const newArray = [...get().transcriptions];
        const currentTranscription = newArray[id];
        if (currentState === 'PAUSED') {
          // Handle Pauses
          if (!text) {
            set({
              isTranscribing: false,
            });
          } else {
            if (!currentTranscription) {
              newArray[id] = {
                createdAt: new Date().toISOString(),
                text,
                id,
              };
              set({
                isTranscribing: false,
                transcriptions: newArray,
              });
            } else {
              currentTranscription.text += `\n${text}`;
              set({
                isTranscribing: false,
                transcriptions: newArray,
              });
            }
          }
        } else {
          // Handle Final Transcription
          if (!text) {
            if (!currentTranscription) {
              newArray[id] = {
                createdAt: new Date().toISOString(),
                text: 'Silence...',
                isEmpty: true,
                id,
              };
              set({
                isTranscribing: false,
                recordingState: 'STOPPED',
                transcriptions: newArray,
                id: id + 1,
              });
              return;
            }
          }
          if (!currentTranscription) {
            newArray[id] = { createdAt: new Date().toISOString(), text, id };
            set({
              isTranscribing: false,
              recordingState: 'STOPPED',
              transcriptions: newArray,
              id: id + 1,
            });
          } else {
            currentTranscription.text += `\n${text}`;
            set({
              isTranscribing: false,
              recordingState: 'STOPPED',
              transcriptions: newArray,
              id: id + 1,
            });
          }
          // Reset timer
          set({
            savedRecordingTimeMs: 0,
            lastStartTime: null,
          });
        }
      },
      updateTranscribingState: (state: boolean) =>
        set({ isTranscribing: state }),
      updateRecordingState: (state: RECORD_STATE) => {
        set({ recordingState: state });
        if (state === 'RECORDING') {
          set({ lastStartTime: new Date() });
        }
        if (state === 'PAUSED') {
          const lastStartTime = get().lastStartTime;
          if (lastStartTime) {
            const currentTime = new Date();
            const timeDiff = currentTime.getTime() - lastStartTime.getTime();
            set({
              savedRecordingTimeMs: get().savedRecordingTimeMs + timeDiff,
            });
          }
        }
      },
    })),
    { name: 'transcriptionStore', trace: true, serialize: { options: true } }
  )
);
