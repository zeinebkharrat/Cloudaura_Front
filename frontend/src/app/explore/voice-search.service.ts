import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VoiceSearchService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private chunks: BlobPart[] = [];

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.navigator?.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  }

  async startCapture(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Voice capture is not supported in this browser.');
    }

    if (this.mediaRecorder?.state === 'recording') {
      return;
    }

    this.mediaStream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = this.pickMimeType();
    this.chunks = [];

    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.mediaStream, { mimeType })
      : new MediaRecorder(this.mediaStream);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
  }

  stopCapture(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active voice recording.'));
        return;
      }

      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();
        if (!blob.size) {
          reject(new Error('Recorded audio is empty.'));
          return;
        }
        resolve(blob);
      };

      recorder.onerror = () => {
        this.cleanup();
        reject(new Error('Voice recording failed.'));
      };

      recorder.stop();
    });
  }

  cancelCapture(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  private pickMimeType(): string | null {
    const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
    for (const type of preferred) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return null;
  }
}
