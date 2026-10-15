// AudioWorklet: copies mic audio to the main thread in hops of 512 samples,
// stamped with the audio-clock time of the hop's last sample.
class MicTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(512);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          const t = currentTime + (i + 1) / sampleRate;
          this.port.postMessage({ t, samples: this.buf }, [this.buf.buffer]);
          this.buf = new Float32Array(512);
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('mic-tap', MicTap);
