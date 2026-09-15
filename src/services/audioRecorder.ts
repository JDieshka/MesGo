/**
 * Audio Recorder Service
 * Uses MediaRecorder API to record voice messages
 */

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private onDurationUpdate: ((duration: number) => void) | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private animationFrame: number | null = null;
  private onWaveformUpdate: ((data: number[]) => void) | null = null;

  async start(
    onDurationUpdate?: (duration: number) => void,
    onWaveformUpdate?: (data: number[]) => void
  ): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup audio context for waveform visualization
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      this.onDurationUpdate = onDurationUpdate || null;
      this.onWaveformUpdate = onWaveformUpdate || null;

      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.startTime = Date.now();

      // Duration timer
      this.durationInterval = setInterval(() => {
        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        this.onDurationUpdate?.(duration);
      }, 1000);

      // Waveform visualization
      this.startWaveformVisualization();
    } catch (err) {
      console.error('[AudioRecorder] Failed to start:', err);
      throw err;
    }
  }

  async stop(): Promise<{ blob: Blob; duration: number; waveform: number[] } | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      const waveform = this.getFinalWaveform();

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.getSupportedMimeType() });
        this.cleanup();
        resolve({ blob, duration: Math.max(duration, 1), waveform });
      };

      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = () => {
        this.cleanup();
      };
      this.mediaRecorder.stop();
    } else {
      this.cleanup();
    }
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  private cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.chunks = [];
    this.analyser = null;
  }

  private startWaveformVisualization(): void {
    const visualize = () => {
      if (!this.analyser || !this.onWaveformUpdate) return;

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);

      // Convert to array of normalized values (0-1)
      const normalized = Array.from(dataArray).map(v => v / 255);
      this.onWaveformUpdate(normalized);

      this.animationFrame = requestAnimationFrame(visualize);
    };
    visualize();
  }

  private getFinalWaveform(): number[] {
    // Generate a simulated waveform based on recording duration
    // In a real app, we'd collect this during recording
    const bars = 30;
    return Array.from({ length: bars }, () => Math.random() * 0.8 + 0.2);
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }
}

// Convert Blob to base64 for transmission via WebSocket
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert base64 back to Blob for playback
export function base64ToBlob(base64: string, mimeType: string = 'audio/webm'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
