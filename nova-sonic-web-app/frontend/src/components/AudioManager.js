import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';

const AudioManager = forwardRef(({ onAudioData, onAudioEnd, onAudioLevel, muted }, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [audioStream, setAudioStream] = useState(null);

  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);

  // Initialize audio context for playback
  const initializeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);

  // Start recording from microphone
  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up audio analysis for level detection
      const context = new AudioContext({ sampleRate: 16000 });
      const source = context.createMediaStreamSource(stream);
      const analyserNode = context.createAnalyser();
      analyserNode.fftSize = 256;
      
      source.connect(analyserNode);
      
      setAudioContext(context);
      setAnalyser(analyserNode);
      setAudioStream(stream);

      // Set up direct PCM processing instead of MediaRecorder
      // Create a ScriptProcessorNode for real-time audio processing
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
      source.connect(scriptProcessor);
      scriptProcessor.connect(context.destination);
      
      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert to 16-bit PCM and send immediately
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample * 0x7FFF;
        }
        
        // Convert to base64 and send
        const uint8Array = new Uint8Array(pcmData.buffer);
        const base64String = btoa(String.fromCharCode.apply(null, uint8Array));
        
        if (onAudioData && base64String.length > 0) {
          onAudioData(base64String);
        }
      };
      
      // Store the processor for cleanup
      setMediaRecorder({ 
        stop: () => {
          scriptProcessor.disconnect();
          source.disconnect();
        },
        state: 'recording'
      });
      setIsRecording(true);

      // Start audio level monitoring
      startAudioLevelMonitoring(analyserNode);

      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }, [onAudioData]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }

    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }

    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }

    setIsRecording(false);
    setMediaRecorder(null);
    setAnalyser(null);

    // Signal end of audio input
    if (onAudioEnd) {
      onAudioEnd();
    }

    console.log('Recording stopped');
  }, [mediaRecorder, audioStream, audioContext, onAudioEnd]);

  // Monitor audio levels for visualization
  const startAudioLevelMonitoring = useCallback((analyserNode) => {
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    
    const updateLevel = () => {
      if (analyserNode && isRecording) {
        analyserNode.getByteFrequencyData(dataArray);
        
        // Calculate average level
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
        
        if (onAudioLevel) {
          onAudioLevel(normalizedLevel);
        }
        
        requestAnimationFrame(updateLevel);
      }
    };
    
    updateLevel();
  }, [isRecording, onAudioLevel]);

  // Convert audio blob to base64 and send
  const convertAndSendAudio = useCallback(async (audioBlob) => {
    try {
      // Convert to PCM format for Nova Sonic
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioData = await convertToPCM(arrayBuffer);
      
      if (onAudioData && audioData) {
        onAudioData(audioData);
      }
    } catch (error) {
      console.error('Error converting audio:', error);
    }
  }, [onAudioData]);

  // Convert audio to PCM format expected by Nova Sonic
  const convertToPCM = useCallback(async (webmBuffer) => {
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(webmBuffer);
      
      // Convert to 16-bit PCM
      const pcmData = audioBuffer.getChannelData(0);
      const pcmBuffer = new ArrayBuffer(pcmData.length * 2);
      const view = new DataView(pcmBuffer);
      
      for (let i = 0; i < pcmData.length; i++) {
        const sample = Math.max(-1, Math.min(1, pcmData[i]));
        view.setInt16(i * 2, sample * 0x7FFF, true);
      }
      
      // Convert to base64
      const uint8Array = new Uint8Array(pcmBuffer);
      const base64String = btoa(String.fromCharCode.apply(null, uint8Array));
      
      await audioContext.close();
      return base64String;
    } catch (error) {
      console.error('Error converting to PCM:', error);
      return null;
    }
  }, []);

  // Play audio data from Nova Sonic
  const playAudioData = useCallback(async (base64AudioData) => {
    if (muted) return;

    try {
      const audioContext = await initializeAudioContext();
      
      // Decode base64 to array buffer
      const binaryString = atob(base64AudioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM to audio buffer
      const audioBuffer = audioContext.createBuffer(1, bytes.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = view.getInt16(i * 2, true) / 0x7FFF;
      }

      // Add to queue for sequential playback
      audioQueueRef.current.push(audioBuffer);
      
      if (!isPlayingRef.current) {
        playNextInQueue(audioContext);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [muted, initializeAudioContext]);

  // Play audio buffers sequentially
  const playNextInQueue = useCallback(async (audioContext) => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift();
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    source.onended = () => {
      // Play next in queue
      setTimeout(() => playNextInQueue(audioContext), 10);
    };
    
    source.start();
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    playAudioData,
    isRecording
  }), [startRecording, stopRecording, playAudioData, isRecording]);

  // This component doesn't render anything visible
  return null;
});

AudioManager.displayName = 'AudioManager';

export default AudioManager;