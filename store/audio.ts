import { MAX_PREVIOUS_TRANSCRIPT_LENGTH } from '@/utils/constants';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type AudioStoreState = {
  listening: boolean;
  recordingState: 'READY' | 'RECORDING' | 'PAUSED';
  streamingTranscriptions: string[];
  fullTranscription: string;
  transcribingStream: boolean;
  transcribingFull: boolean;
  transcriptionHistory: string[];
  recordingFunctions: {
    startRecording: (cleanPrevious: boolean) => void;
    stopRecording: () => void;
    pauseRecording: () => void;
  } | null;
};

export const getTranscriptPrompt = (streamingTranscriptions: string[]) => {
  if (!streamingTranscriptions.length)
    return 'Audio from Cath Gilmour about writing a message: ';

  const joinedTranscriptions = streamingTranscriptions.join(' ');

  const trimmedTranscription = joinedTranscriptions.substring(
    joinedTranscriptions.length - MAX_PREVIOUS_TRANSCRIPT_LENGTH,
    joinedTranscriptions.length
  );

  const firstSpace = trimmedTranscription.indexOf(' ');

  if (firstSpace === -1) return '...' + trimmedTranscription;

  return trimmedTranscription.substring(firstSpace + 1);
};

export const useAudioStore = create<AudioStoreState>()(
  devtools(
    (set, get) => ({
      listening: false,
      fullTranscription: '',
      transcribingFull: false,
      transcribingStream: false,
      transcriptionHistory: [],
      streamingTranscriptions: [],
      recordingState: 'READY',
      recordingFunctions: null,
    }),
    { name: 'audioStore', trace: true, serialize: { options: true } }
  )
);

export const setFullTranscription = (transcription: string) => {
  useAudioStore.setState(
    (state) => ({
      fullTranscription: transcription,
      transcriptionHistory: [...state.transcriptionHistory, transcription],
    }),
    false,
    'SET_FULL_TRANSCRIPTION'
  );
};

export const addStreamingTranscription = (transcription: string) => {
  useAudioStore.setState(
    (state) => ({
      streamingTranscriptions: [
        ...state.streamingTranscriptions,
        transcription,
      ],
    }),
    false,
    'ADDED_STREAMING_TRANSCRIPTION'
  );
};

export const setTranscribingStream = (transcribingState: boolean) => {
  useAudioStore.setState(
    (state) => ({
      transcribingStream: transcribingState,
    }),
    false,
    'SET_TRANSCRIBING_STREAM'
  );
};

export const setTranscribingFull = (transcribingState: boolean) => {
  useAudioStore.setState(
    (state) => ({
      transcribingFull: transcribingState,
    }),
    false,
    'SET_TRANSCRIBING_FULL'
  );
};

export const updateListening = (listening: boolean) => {
  useAudioStore.setState({ listening }, false, 'UPDATED_LISTENING');
};

export const getReadyToRecord = (
  startRecording: () => void,
  stopRecording: () => void,
  pauseRecording: () => void
) => {
  useAudioStore.setState({
    recordingFunctions: {
      startRecording: (cleanPrevious: boolean) => {
        startRecording();

        let newState: Partial<AudioStoreState> = {
          recordingState: 'RECORDING',
        };

        if (cleanPrevious) {
          newState = {
            ...newState,
            transcribingFull: false,
            transcribingStream: false,
            streamingTranscriptions: [],
            fullTranscription: '',
          };
        }

        return useAudioStore.setState(newState, false, 'STARTED_RECORDING');
      },
      stopRecording: () => {
        stopRecording();
        return useAudioStore.setState(
          { recordingState: 'READY' },
          false,
          'STOPPED_RECORDING'
        );
      },
      pauseRecording: () => {
        pauseRecording();
        return useAudioStore.setState(
          { recordingState: 'PAUSED' },
          false,
          'PAUSED_RECORDING'
        );
      },
    },
  });
};

export default useAudioStore;
