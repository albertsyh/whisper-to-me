import AudioInput from "./AudioInput";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className="p-3">
        <h1 className="text-lg font-bold">Whisper - English Transcriber</h1>
        <AudioInput />
      </div>
    </main>
  );
}
