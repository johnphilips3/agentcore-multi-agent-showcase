import React from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, Radio } from 'lucide-react';

const StatusIndicator = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <Wifi className="h-4 w-4" />,
          text: 'Connected',
          color: 'text-green-400',
          bg: 'bg-green-900/20',
          border: 'border-green-500/30'
        };
      case 'session_active':
        return {
          icon: <Radio className="h-4 w-4" />,
          text: 'Session Active',
          color: 'text-blue-400',
          bg: 'bg-blue-900/20',
          border: 'border-blue-500/30'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="h-4 w-4" />,
          text: 'Disconnected',
          color: 'text-gray-400',
          bg: 'bg-gray-900/20',
          border: 'border-gray-500/30'
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Connection Error',
          color: 'text-red-400',
          bg: 'bg-red-900/20',
          border: 'border-red-500/30'
        };
      default:
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Unknown',
          color: 'text-gray-400',
          bg: 'bg-gray-900/20',
          border: 'border-gray-500/30'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border ${config.bg} ${config.border}`}>
      <div className={config.color}>
        {config.icon}
      </div>
      <span className={`text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
      {status === 'session_active' && (
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
      )}
    </div>
  );
};

export default StatusIndicator;