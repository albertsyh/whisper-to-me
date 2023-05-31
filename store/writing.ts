import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type TimestampedText = {
  timestamp: Date;
  text: string;
};

export type WritingStoreState = {
  processing: boolean;
  processedWritingVersions: TimestampedText[];
  processedTranscriptionsUntilIndex: number;
  writingType: 'email'; // This is so we can add more types of writing later - maybe they can select them with a slider
};

export const useWritingStore = create<WritingStoreState>()(
  devtools(
    (set, get) => ({
      processing: false,
      transcribedUpdates: [],
      processedWritingVersions: [],
      processedTranscriptionsUntilIndex: 0,
      writingType: 'email',
    }),
    { name: 'writingStore', trace: true, serialize: { options: true } }
  )
);

export const setProcessing = (processing: boolean) => {
  useWritingStore.setState({ processing });
};

export const newWritingVersion = (text: string | null) => {
  if (!text)
    return useWritingStore.setState({
      processedTranscriptionsUntilIndex:
        useWritingStore.getState().processedTranscriptionsUntilIndex + 1,
    });

  return useWritingStore.setState({
    processedWritingVersions: [
      ...useWritingStore.getState().processedWritingVersions,
      {
        timestamp: new Date(),
        text,
      },
    ],
    processedTranscriptionsUntilIndex:
      useWritingStore.getState().processedTranscriptionsUntilIndex + 1,
  });
};
