// Scribe Audio Worklet Processor - High-performance audio stream processor
class ScribeAudioProcessor extends AudioWorkletProcessor {
  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData && channelData.length > 0) {
        // Send audio samples to content script worker port
        this.port.postMessage(channelData);
      }
    }
    return true;
  }
}

registerProcessor('scribe-audio-processor', ScribeAudioProcessor);
