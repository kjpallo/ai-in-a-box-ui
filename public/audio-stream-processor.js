class PCMStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;

    this.port.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'push' && data.samples) {
        this.queue.push(data.samples);
      }

      if (data.type === 'clear') {
        this.queue.length = 0;
        this.current = null;
        this.offset = 0;
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output?.length) return true;

    const left = output[0];
    const right = output[1] || output[0];
    left.fill(0);
    right.fill(0);

    let written = 0;

    while (written < left.length) {
      if (!this.current) {
        this.current = this.queue.shift() || null;
        this.offset = 0;
        if (!this.current) break;
      }

      const remainingInChunk = this.current.length - this.offset;
      const remainingInFrame = left.length - written;
      const copyCount = Math.min(remainingInChunk, remainingInFrame);

      for (let i = 0; i < copyCount; i += 1) {
        const sample = this.current[this.offset + i] || 0;
        left[written + i] = sample;
        right[written + i] = sample;
      }

      written += copyCount;
      this.offset += copyCount;

      if (this.offset >= this.current.length) {
        this.current = null;
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-stream-processor', PCMStreamProcessor);
