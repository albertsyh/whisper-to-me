type RemoveSilencePropTypes = {
    showLogs: boolean | undefined;
    blob: Blob;
    threshold: number;
};
declare function removeSilenceWithFfmpeg({ showLogs, blob: currentBlob, threshold, }: RemoveSilencePropTypes): Promise<Blob | null>;

export { removeSilenceWithFfmpeg };
