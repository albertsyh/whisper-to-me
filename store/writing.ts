import { create } from 'zustand';

export type WritingStoreState = {
  processingWithGPT: boolean;
  processedWritingVersions: { timestamp: Date; text: string }[];
  requestedUpdates: { timestamp: Date; text: string }[];
  writingType: 'email'; // This is so we can add more types of writing later - maybe they can select them with a slider
};

export const useWritingStore = create<WritingStoreState>(() => ({
  processingWithGPT: false,
  processedWritingVersions: [],
  requestedUpdates: [],
  writingType: 'email',
}));
