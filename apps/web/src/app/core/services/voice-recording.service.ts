import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private chunks: Blob[] = [];

  isAvailable(): boolean {
    return !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  async startRecording(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('MediaDevices.getUserMedia is not available');
    }
    this.chunks = [];
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Prefer audio/mp4: Hugging Face (fal-ai) supports mp4 but not webm
    const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };
    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('Recording is not active'));
        return;
      }
      this.mediaRecorder.onstop = () => {
        this.cleanup();
        const mimeType = this.mediaRecorder?.mimeType ?? 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        resolve(blob);
      };
      this.mediaRecorder.onerror = (e) => {
        this.cleanup();
        reject(new Error((e as ErrorEvent).message ?? 'Recording failed'));
      };
      this.mediaRecorder.stop();
    });
  }

  /**
   * Stops recording and releases MediaStream tracks without returning a blob.
   * Use on component destroy to avoid leaking resources when user navigates away.
   */
  cancelRecording(): void {
    if (this.mediaRecorder?.state !== 'inactive') {
      this.mediaRecorder?.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
  }
}
