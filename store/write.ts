import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * This store is a lot simpler, lot less async things to keep track of. The
 * primary concerns I wanted to add were:
 * 1. Ability to load this store from persistence as the central source of truth.
 * 2. Able to work in parallel, where jobs here aren't affecting the jobs in transcription.
 * We manage state internally so that writing versions that depend on each other
 * can start automatically. You can test this by adding two transcripts quickly, you'll see
 * the second one fire and go as soon as the first is done.
 * 3. Grouping - I wanted to have some primitive groups so that,
 * a. We can have multiple writing jobs in memory
 * b. Other processes can use GPT for transcriptions if they need to.
 *
 *
 * Note: You'll see that actual streaming updates are handled entirely in-component.
 * This was primarily so that this store doesn't have to re-compute too much - even with
 * Immer it wasn't awesome how much re-copying took place to maintain immutability.
 */

export type WritingStoreState = {
  versions: {
    startedAt: number; // In the case of rehydrate from a transcribestore, we might need to fuzz these since they're also ids
    completedAt?: Date;
    previousCompletedOutput?: string;
    inputText: string;
    readyToStart: boolean;
    state: 'PROCESSING' | 'STREAMING' | 'COMPLETED' | 'FAILED';
    groupId: number;
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

export const startVersion = (inputText: string, groupId: number) => {
  const startedAt = Date.now();

  useWritingStore.setState(
    (state) => {
      const readyToStart =
        state.versions.length === 0 ||
        state.versions.every(
          (version) =>
            version.state === 'COMPLETED' || version.state === 'FAILED'
        );

      return {
        versions: [
          ...state.versions,
          {
            startedAt,
            groupId,
            readyToStart,
            inputText,
            state: 'PROCESSING',
            type: 'EMAIL',
          },
        ],
      };
    },
    false,
    'START_VERSION'
  );

  return startedAt;
};

export const completeVersion = (versionId: number, outputText?: string) => {
  useWritingStore.setState(
    (state) => {
      const newVersions: WritingStoreState['versions'] = JSON.parse(
        JSON.stringify(state.versions)
      );

      const matchingVersionId = newVersions.findIndex(
        (version) => version.startedAt === versionId
      );

      if (matchingVersionId === -1) {
        console.error('No matching version found for id', versionId);
        return {};
      }

      const matchingVersion = newVersions[matchingVersionId];

      console.log(
        'Matching version id is ',
        matchingVersionId,
        ' new Versions length is ',
        newVersions.length
      );

      if (newVersions.length - matchingVersionId > 1) {
        newVersions[matchingVersionId + 1].readyToStart = true;
        newVersions[matchingVersionId + 1].previousCompletedOutput = outputText;
        console.log('Next version is ', newVersions[matchingVersionId + 1]);
      }

      matchingVersion.completedAt = new Date();

      if (outputText) {
        matchingVersion.state = 'COMPLETED';
        matchingVersion.outputText = outputText;
      } else {
        matchingVersion.state = 'FAILED';
        matchingVersion.outputText = undefined;
      }

      return {
        versions: newVersions,
      };
    },
    false,
    'COMPLETE_VERSION'
  );
};
