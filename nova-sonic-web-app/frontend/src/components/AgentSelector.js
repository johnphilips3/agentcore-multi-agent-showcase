import React, { useState, useEffect } from 'react';
import { ChevronDown, RefreshCw, Bot, User } from 'lucide-react';
import axios from 'axios';

const AgentSelector = ({ selectedAgent, onAgentSelect, selectedVoice, onVoiceSelect }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState('us-east-1');

  const availableVoices = [
    { id: 'matthew', name: 'Matthew', description: 'Natural male voice' },
    { id: 'olivia', name: 'Olivia', description: 'Natural female voice' },
    { id: 'ruth', name: 'Ruth', description: 'Warm female voice' },
    { id: 'stephen', name: 'Stephen', description: 'Clear male voice' }
  ];

  const availableRegions = [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-west-2', name: 'US West (Oregon)' },
    { id: 'eu-west-1', name: 'Europe (Ireland)' },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' }
  ];

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/agents?region=${region}`);
      setAgents(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch agents');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [region]);

  const handleAgentSelect = (agent) => {
    onAgentSelect(agent);
  };

  const handleRefresh = () => {
    fetchAgents();
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
        <Bot className="h-5 w-5" />
        <span>Agent Configuration</span>
      </h3>

      {/* Region Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          AWS Region
        </label>
        <div className="relative">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400 appearance-none"
          >
            {availableRegions.map((r) => (
              <option key={r.id} value={r.id} className="bg-gray-800">
                {r.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Agent Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">
            AgentCore Agent
          </label>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh agents"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-black/30 border border-white/20 rounded-lg p-3 text-center text-gray-400">
            Loading agents...
          </div>
        ) : agents.length === 0 && !error ? (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300">
            No agents found in {availableRegions.find(r => r.id === region)?.name}. 
            Make sure you have deployed agents in this region.
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.agent_id}
                onClick={() => handleAgentSelect(agent)}
                className={`bg-black/30 border rounded-lg p-3 cursor-pointer transition-all hover:bg-black/50 ${
                  selectedAgent?.agent_id === agent.agent_id
                    ? 'border-blue-400 bg-blue-900/20'
                    : 'border-white/20 hover:border-white/30'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Bot className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">
                      {agent.name}
                    </h4>
                    {agent.description && (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                        {agent.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>v{agent.version}</span>
                      <span className={`px-2 py-1 rounded-full ${
                        agent.status === 'READY' 
                          ? 'bg-green-900/30 text-green-300' 
                          : 'bg-yellow-900/30 text-yellow-300'
                      }`}>
                        {agent.status}
                      </span>
                    </div>
                  </div>
                  {selectedAgent?.agent_id === agent.agent_id && (
                    <div className="text-blue-400">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voice Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300 flex items-center space-x-2">
          <User className="h-4 w-4" />
          <span>Voice Selection</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableVoices.map((voice) => (
            <div
              key={voice.id}
              onClick={() => onVoiceSelect(voice.id)}
              className={`bg-black/30 border rounded-lg p-3 cursor-pointer transition-all hover:bg-black/50 ${
                selectedVoice === voice.id
                  ? 'border-blue-400 bg-blue-900/20'
                  : 'border-white/20 hover:border-white/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white text-sm font-medium">
                    {voice.name}
                  </h4>
                  <p className="text-gray-400 text-xs">
                    {voice.description}
                  </p>
                </div>
                {selectedVoice === voice.id && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Configuration Summary */}
      {selectedAgent && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
          <h4 className="text-green-300 text-sm font-medium mb-2">Ready to Start</h4>
          <div className="text-xs text-green-200 space-y-1">
            <div>Agent: {selectedAgent.name}</div>
            <div>Voice: {availableVoices.find(v => v.id === selectedVoice)?.name}</div>
            <div>Region: {availableRegions.find(r => r.id === region)?.name}</div>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-200">
        <h4 className="font-medium mb-1">Quick Start:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Select an agent and voice above</li>
          <li>Click the green phone button to start a session</li>
          <li>Use the blue microphone button to speak</li>
          <li>The AI will respond with voice and text</li>
        </ol>
      </div>
    </div>
  );
};

export default AgentSelector;