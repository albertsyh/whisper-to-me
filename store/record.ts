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
  disabled: boolean;
  lastRecordingStart: Date | null;
  streamingTranscriptions: { text: string; createdAt: Date }[];
  savedRecordingTimeMs: number;
  recordingState: RECORD_STATE;
  isTranscribing: boolean;
  transcriptions: Transcription[];
  updateRecordingState: (state: RECORD_STATE) => void;
  updateTranscribingState: (state: boolean) => void;
  onTranscribe: (text: string) => void;
};

export const useTranscriptionStore = create<TranscriptionStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // TODO: Why?
      id: 0,
      disabled: false,
      savedRecordingTimeMs: 0,
      streamingTranscriptions: [],
      lastRecordingStart: null,
      recordingState: null,
      isTranscribing: false,
      transcriptions: [],
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
        }
      },
      updateTranscribingState: (
        state: boolean // TODO: Using state might be confusing everywhere
      ) => set({ isTranscribing: state }),
      updateRecordingState: (state: RECORD_STATE) => {
        let updates: Partial<TranscriptionStore> = {
          savedRecordingTimeMs: get().savedRecordingTimeMs,
          recordingState: state,
        };

        if (state === 'RECORDING') {
          updates.lastRecordingStart = new Date();

          // if (get().recordingState !== 'PAUSED') {
          //   updates.id = get().id + 1;
          // }

          if (get().recordingState !== 'PAUSED')
            updates.savedRecordingTimeMs = 0;
        } else if (
          state === 'PAUSED' ||
          state === 'STOPPED' ||
          state == 'READY'
        ) {
          const lastRecordingStart = get().lastRecordingStart;
          if (lastRecordingStart)
            updates.savedRecordingTimeMs! +=
              new Date().getTime() - lastRecordingStart.getTime();
          updates.lastRecordingStart = null;
        }

        return set(updates);
      },
    })),
    { name: 'transcriptionStore', trace: true, serialize: { options: true } }
  )
);

export const setRecordingDisabled = (disabled: boolean) => {
  useTranscriptionStore.setState(
    { disabled },
    false,
    'DISABLE_ENABLE_RECORDING'
  );
};

export const addStreamingTranscription = (text: string) => {
  useTranscriptionStore.setState(
    {
      streamingTranscriptions: [
        ...useTranscriptionStore.getState().streamingTranscriptions,
        { text, createdAt: new Date() },
      ],
    },
    false,
    'ADD_STREAMING_TRANSCRIPTION'
  );
};
