import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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

// export const streamToVersion = (versionId: number, token: string) => {
//   useWritingStore.setState((state) => {
//     const newVersions: WritingStoreState['versions'] = JSON.parse(
//       JSON.stringify(state.versions)
//     );

//     const matchingVersion = newVersions.find(
//       (version) => version.startedAt === versionId
//     );

//     if (!matchingVersion) {
//       console.error('No matching version found for id', versionId);
//       return {};
//     }

//     matchingVersion.state = 'STREAMING';
//     matchingVersion.outputText = matchingVersion.outputText
//       ? matchingVersion.outputText + token
//       : token;

//     return {
//       versions: newVersions,
//     };
//   });
// };

// export const markVersionCompleted = (versionId: number, failed?: boolean) => {
//   useWritingStore.setState((state) => {
//     const newVersions: WritingStoreState['versions'] = JSON.parse(
//       JSON.stringify(state.versions)
//     );

//     const matchingVersion = newVersions.find(
//       (version) => version.startedAt === versionId
//     );

//     if (!matchingVersion) {
//       console.error('No matching version found for id', versionId);
//       return {};
//     }

//     if (failed) matchingVersion.state = 'FAILED';
//     else matchingVersion.state = 'COMPLETED';
//     matchingVersion.completedAt = new Date();

//     return {
//       versions: newVersions,
//     };
//   });
// };

// ################## SELECTORS ##################
