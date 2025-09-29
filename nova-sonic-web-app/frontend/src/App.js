import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Settings, 
  MessageSquare, 
  Volume2, 
  VolumeX,
  Phone,
  PhoneOff,
  Zap,
  Brain,
  Radio
} from 'lucide-react';
import './App.css';
import AudioManager from './components/AudioManager';
import AgentSelector from './components/AgentSelector';
import TranscriptDisplay from './components/TranscriptDisplay';
import ToolVisualization from './components/ToolVisualization';
import StatusIndicator from './components/StatusIndicator';

function App() {
  // WebSocket and connection state
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState('matthew');

  // Conversation state
  const [transcript, setTranscript] = useState([]);
  const [currentToolUse, setCurrentToolUse] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  
  // Refs
  const audioManagerRef = useRef(null);
  const clientId = useRef(Math.random().toString(36).substring(7));

  // WebSocket connection management
  useEffect(() => {
    // Auto-connect on mount
    console.log('🚀 Component mounted, attempting WebSocket connection...');
    connectWebSocket();
    
    return () => {
      if (socket) {
        console.log('🧹 Cleaning up WebSocket connection...');
        socket.close();
      }
    };
  }, []); // Empty dependency array for mount only
  
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  const connectWebSocket = () => {
    if (socket) return;

    // Use backend port for WebSocket connection
    const backendHost = process.env.NODE_ENV === 'production' 
      ? window.location.host 
      : 'localhost:8000';
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${backendHost}/ws/${clientId.current}`;
    
    console.log('🔌 Attempting WebSocket connection to:', wsUrl);
    console.log('Client ID:', clientId.current);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Backend host:', backendHost);
    
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('✅ WebSocket connected successfully!');
      setIsConnected(true);
      setConnectionStatus('connected');
    };

    newSocket.onmessage = (event) => {
      console.log('📨 WebSocket message received:', event.data);
      handleWebSocketMessage(JSON.parse(event.data));
    };

    newSocket.onclose = (event) => {
      console.log('❌ WebSocket disconnected:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setSocket(null);
      setSessionActive(false);
    };

    newSocket.onerror = (error) => {
      console.error('🚨 WebSocket error:', error);
      console.error('WebSocket ready state:', newSocket.readyState);
      setConnectionStatus('error');
    };

    setSocket(newSocket);
  };

  const handleWebSocketMessage = (message) => {
    console.log('Received message:', message);

    switch (message.type) {
      case 'session_started':
        setSessionActive(true);
        setConnectionStatus('session_active');
        addTranscriptMessage('system', `Session started with voice: ${message.voice_id}`);
        break;

      case 'session_stopped':
        setSessionActive(false);
        setConnectionStatus('connected');
        addTranscriptMessage('system', 'Session ended');
        break;

      case 'transcript':
        addTranscriptMessage(message.role, message.content);
        break;

      case 'audio_output':
        if (audioManagerRef.current) {
          audioManagerRef.current.playAudioData(message.audio_data);
        }
        break;

      case 'tool_use_started':
        setCurrentToolUse({
          name: message.tool_name,
          id: message.tool_id,
          status: 'running'
        });
        setIsProcessing(true);
        addTranscriptMessage('system', `🔧 Using tool: ${message.tool_name}`);
        break;

      case 'tool_result':
        setCurrentToolUse(prev => prev ? { ...prev, status: 'completed', result: message.result } : null);
        setIsProcessing(false);
        addTranscriptMessage('system', `✅ Tool completed: ${message.tool_name}`);
        break;

      case 'tool_error':
        setCurrentToolUse(prev => prev ? { ...prev, status: 'error', error: message.error } : null);
        setIsProcessing(false);
        addTranscriptMessage('system', `❌ Tool error: ${message.error}`);
        break;

      case 'completion_end':
        setIsProcessing(false);
        setCurrentToolUse(null);
        break;

      case 'error':
        console.error('Server error:', message.message);
        addTranscriptMessage('system', `Error: ${message.message}`);
        setIsProcessing(false);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const addTranscriptMessage = (role, content) => {
    const message = {
      id: Date.now(),
      role,
      content,
      timestamp: new Date().toLocaleTimeString()
    };
    setTranscript(prev => [...prev, message]);
  };

  const startSession = () => {
    if (!socket || !isConnected) {
      connectWebSocket();
      return;
    }

    const message = {
      type: 'start_session',
      agent_arn: selectedAgent?.arn,
      voice_id: selectedVoice,
      tools_enabled: true
    };

    socket.send(JSON.stringify(message));
  };

  const stopSession = () => {
    if (socket && isConnected) {
      socket.send(JSON.stringify({ type: 'stop_session' }));
    }
    
    if (audioManagerRef.current) {
      audioManagerRef.current.stopRecording();
    }
    
    setIsRecording(false);
    setIsProcessing(false);
    setCurrentToolUse(null);
  };

  const toggleRecording = () => {
    if (!sessionActive) return;

    if (isRecording) {
      audioManagerRef.current?.stopRecording();
      setIsRecording(false);
    } else {
      audioManagerRef.current?.startRecording();
      setIsRecording(true);
    }
  };

  const sendAudioData = (audioData) => {
    if (socket && isConnected && sessionActive) {
      const message = {
        type: 'audio_chunk',
        audio_data: audioData
      };
      socket.send(JSON.stringify(message));
    }
  };

  const endAudioInput = () => {
    if (socket && isConnected && sessionActive) {
      socket.send(JSON.stringify({ type: 'end_audio' }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Radio className="h-8 w-8 text-blue-400" />
                <h1 className="text-xl font-bold text-white">Nova Sonic</h1>
              </div>
              <StatusIndicator status={connectionStatus} />
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className={`p-2 rounded-lg transition-colors ${
                  showTranscript 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
                title="Toggle transcript"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${
                  showSettings 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Control Panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Agent Selection */}
            {showSettings && (
              <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <AgentSelector
                  selectedAgent={selectedAgent}
                  onAgentSelect={setSelectedAgent}
                  selectedVoice={selectedVoice}
                  onVoiceSelect={setSelectedVoice}
                />
              </div>
            )}

            {/* Voice Control Interface */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 p-8">
              <div className="text-center space-y-6">
                
                {/* Session Status */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white">
                    Voice Assistant
                  </h2>
                  <p className="text-gray-300">
                    {sessionActive 
                      ? 'Ready to listen - Press and hold to speak' 
                      : 'Start a session to begin voice interaction'
                    }
                  </p>
                </div>

                {/* Audio Level Indicator */}
                {isRecording && (
                  <div className="flex justify-center">
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all duration-150 ${
                            i < audioLevel * 10 
                              ? 'bg-green-400 h-8' 
                              : 'bg-gray-600 h-2'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex justify-center items-center space-x-6">
                  
                  {/* Main Action Button */}
                  {!sessionActive ? (
                    <button
                      onClick={startSession}
                      disabled={!isConnected}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white p-6 rounded-full shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
                      title="Start session"
                    >
                      <Phone className="h-8 w-8" />
                    </button>
                  ) : (
                    <button
                      onClick={stopSession}
                      className="bg-red-500 hover:bg-red-600 text-white p-6 rounded-full shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
                      title="End session"
                    >
                      <PhoneOff className="h-8 w-8" />
                    </button>
                  )}

                  {/* Recording Button */}
                  {sessionActive && (
                    <button
                      onClick={toggleRecording}
                      className={`p-6 rounded-full shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95 ${
                        isRecording
                          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                      title={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                      {isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                    </button>
                  )}

                  {/* Mute Button */}
                  {sessionActive && (
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-4 rounded-full shadow-lg transition-colors ${
                        isMuted 
                          ? 'bg-gray-500 text-white' 
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                    </button>
                  )}
                </div>

                {/* Tool Processing Indicator */}
                {isProcessing && (
                  <div className="flex items-center justify-center space-x-3 text-blue-400">
                    <Brain className="h-5 w-5 animate-pulse" />
                    <span className="text-sm">AI is thinking...</span>
                    <Zap className="h-4 w-4 animate-bounce" />
                  </div>
                )}
              </div>
            </div>

            {/* Tool Visualization */}
            {currentToolUse && (
              <ToolVisualization toolUse={currentToolUse} />
            )}
          </div>

          {/* Transcript Panel */}
          {showTranscript && (
            <div className="lg:col-span-1">
              <TranscriptDisplay 
                transcript={transcript} 
                onClear={() => setTranscript([])}
              />
            </div>
          )}
        </div>
      </div>

      {/* Audio Manager Component */}
      <AudioManager
        ref={audioManagerRef}
        onAudioData={sendAudioData}
        onAudioEnd={endAudioInput}
        onAudioLevel={setAudioLevel}
        muted={isMuted}
      />
    </div>
  );
}

export default App;