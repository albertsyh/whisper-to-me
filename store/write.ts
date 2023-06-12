import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type WritingStoreState = {
  versions: {
    startedAt: number; // In the case of rehydrate from a transcribestore, we might need to fuzz these since they're also ids
    completedAt?: Date;
    inputText: string;
    state: 'PROCESSING' | 'STREAMING' | 'COMPLETED' | 'FAILED';
    outputText?: string; // we can add a group id later in case we do multiple writing streams?
    type: 'EMAIL'; // We can add more later
  }[];
};

export const useWritingStore = create<WritingStoreState>()(
  devtools(
    (set, get) => ({
      versions: [],
    }),
    { name: 'WritingStore', trace: true, serialize: { options: true } }
  )
);

export const startVersion = (inputText: string) => {
  const startedAt = Date.now();

  useWritingStore.setState({
    versions: [
      ...useWritingStore.getState().versions,
      {
        startedAt,
        inputText,
        state: 'PROCESSING',
        type: 'EMAIL',
      },
    ],
  });

  return startedAt;
};

export const streamToVersion = (versionId: number, token: string) => {
  useWritingStore.setState((state) => {
    const newVersions: WritingStoreState['versions'] = JSON.parse(
      JSON.stringify(state.versions)
    );

    const matchingVersion = newVersions.find(
      (version) => version.startedAt === versionId
    );

    if (!matchingVersion) {
      console.error('No matching version found for id', versionId);
      return {};
    }

    matchingVersion.state = 'STREAMING';
    matchingVersion.outputText = matchingVersion.outputText
      ? matchingVersion.outputText + token
      : token;

    return {
      versions: newVersions,
    };
  });
};

export const markVersionCompleted = (versionId: number, failed?: boolean) => {
  useWritingStore.setState((state) => {
    const newVersions: WritingStoreState['versions'] = JSON.parse(
      JSON.stringify(state.versions)
    );

    const matchingVersion = newVersions.find(
      (version) => version.startedAt === versionId
    );

    if (!matchingVersion) {
      console.error('No matching version found for id', versionId);
      return {};
    }

    if (failed) matchingVersion.state = 'FAILED';
    else matchingVersion.state = 'COMPLETED';
    matchingVersion.completedAt = new Date();

    return {
      versions: newVersions,
    };
  });
};

// ################## SELECTORS ##################
