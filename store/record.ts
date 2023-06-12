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

export type RecordingStore = {
  id: number;
  recordingState: RECORD_STATE;
  isTranscribing: boolean;
  transcriptions: Transcription[];
  lastStartTime: Date | null;
  savedRecordingTimeMs: number;
};

// https://github.com/pmndrs/zustand#using-subscribe-with-selector
export const useRecordingStore = create<RecordingStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      id: 0,
      recordingState: null,
      isTranscribing: false,
      transcriptions: [],
      lastStartTime: null,
      savedRecordingTimeMs: 0,
    })),
    { name: 'recordingStore', trace: true, serialize: { options: true } }
  )
);

export const updateTranscribingState = (isTranscribing: boolean) =>
  useRecordingStore.setState({ isTranscribing });

export const updateRecordingState = (state: RECORD_STATE) => {
  useRecordingStore.setState({ recordingState: state });
  if (state === 'RECORDING') {
    useRecordingStore.setState({ lastStartTime: new Date() });
  }
  if (state === 'PAUSED') {
    const lastStartTime = useRecordingStore.getState().lastStartTime;
    if (lastStartTime) {
      const currentTime = new Date();
      const timeDiff = currentTime.getTime() - lastStartTime.getTime();
      useRecordingStore.setState({
        savedRecordingTimeMs:
          useRecordingStore.getState().savedRecordingTimeMs + timeDiff,
      });
    }
  }
};

export const updateStoreOnTranscribe = (text: string) => {
  const { recordingState, id, transcriptions } = useRecordingStore.getState();
  const currentState = recordingState;
  const newArray = [...transcriptions];
  const currentTranscription = newArray[id];
  if (currentState === 'PAUSED') {
    // Handle Pauses
    if (!text) {
      useRecordingStore.setState({
        isTranscribing: false,
      });
    } else {
      if (!currentTranscription) {
        newArray[id] = {
          createdAt: new Date().toISOString(),
          text,
          id,
        };
        useRecordingStore.setState({
          isTranscribing: false,
          transcriptions: newArray,
        });
      } else {
        currentTranscription.text += `\n${text}`;
        useRecordingStore.setState({
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
        useRecordingStore.setState({
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
      useRecordingStore.setState({
        isTranscribing: false,
        recordingState: 'STOPPED',
        transcriptions: newArray,
        id: id + 1,
      });
    } else {
      currentTranscription.text += `\n${text}`;
      useRecordingStore.setState({
        isTranscribing: false,
        recordingState: 'STOPPED',
        transcriptions: newArray,
        id: id + 1,
      });
    }
    // Reset timer
    useRecordingStore.setState({
      savedRecordingTimeMs: 0,
      lastStartTime: null,
    });
  }
};
