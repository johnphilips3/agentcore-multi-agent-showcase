import React from 'react';
import { Wrench, Calendar, Package, Tractor, Brain, CheckCircle, XCircle, Loader } from 'lucide-react';

const ToolVisualization = ({ toolUse }) => {
  if (!toolUse) return null;

  const getToolIcon = (toolName) => {
    const name = toolName.toLowerCase();
    if (name.includes('date') || name.includes('time')) {
      return <Calendar className="h-5 w-5" />;
    }
    if (name.includes('order') || name.includes('track')) {
      return <Package className="h-5 w-5" />;
    }
    if (name.includes('alpaca') || name.includes('farm')) {
      return <Tractor className="h-5 w-5" />;
    }
    if (name.includes('agent') || name.includes('assistant')) {
      return <Brain className="h-5 w-5" />;
    }
    return <Wrench className="h-5 w-5" />;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <Loader className="h-4 w-4 animate-spin text-blue-400" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Loader className="h-4 w-4 animate-spin text-blue-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'border-blue-500/30 bg-blue-900/20';
      case 'completed':
        return 'border-green-500/30 bg-green-900/20';
      case 'error':
        return 'border-red-500/30 bg-red-900/20';
      default:
        return 'border-blue-500/30 bg-blue-900/20';
    }
  };

  const formatToolName = (name) => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const renderResult = (result) => {
    if (!result) return null;

    if (typeof result === 'object') {
      // Special handling for different tool result types
      if (result.orderStatus) {
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Status:</span>
                <span className="ml-2 text-white">{result.orderStatus}</span>
              </div>
              <div>
                <span className="text-gray-400">Order:</span>
                <span className="ml-2 text-white">{result.orderNumber}</span>
              </div>
            </div>
            {result.estimatedDelivery && (
              <div className="text-sm">
                <span className="text-gray-400">Delivery:</span>
                <span className="ml-2 text-white">{result.estimatedDelivery}</span>
              </div>
            )}
          </div>
        );
      }

      if (result.formattedTime) {
        return (
          <div className="space-y-2">
            <div className="text-lg font-mono text-white">{result.formattedTime}</div>
            <div className="text-sm text-gray-300">
              {result.date} - {result.dayOfWeek} ({result.timezone})
            </div>
          </div>
        );
      }

      if (result.data && Array.isArray(result.data)) {
        return (
          <div className="space-y-2">
            <div className="text-sm text-gray-400">Found {result.data.length} items</div>
            <div className="space-y-1">
              {result.data.slice(0, 3).map((item, index) => (
                <div key={index} className="text-sm text-white bg-black/30 rounded px-2 py-1">
                  {item.name || item.title || `Item ${index + 1}`}
                </div>
              ))}
              {result.data.length > 3 && (
                <div className="text-xs text-gray-400">
                  and {result.data.length - 3} more...
                </div>
              )}
            </div>
          </div>
        );
      }

      // Generic object display
      return (
        <div className="text-sm">
          <pre className="bg-black/30 rounded p-2 text-xs text-gray-300 overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      );
    }

    return (
      <div className="text-sm text-white">
        {result.toString()}
      </div>
    );
  };

  return (
    <div className={`bg-black/20 backdrop-blur-sm rounded-xl border p-4 ${getStatusColor(toolUse.status)}`}>
      <div className="flex items-start space-x-3">
        <div className="text-blue-400 mt-1">
          {getToolIcon(toolUse.name)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-white font-medium">
              {formatToolName(toolUse.name)}
            </h3>
            <div className="flex items-center space-x-1">
              {getStatusIcon(toolUse.status)}
              <span className={`text-xs capitalize ${
                toolUse.status === 'completed' ? 'text-green-300' :
                toolUse.status === 'error' ? 'text-red-300' : 'text-blue-300'
              }`}>
                {toolUse.status}
              </span>
            </div>
          </div>

          {toolUse.status === 'running' && (
            <div className="text-sm text-gray-300 mb-3">
              Processing request...
            </div>
          )}

          {toolUse.result && toolUse.status === 'completed' && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">Result:</div>
              {renderResult(toolUse.result)}
            </div>
          )}

          {toolUse.error && toolUse.status === 'error' && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">Error:</div>
              <div className="text-sm text-red-300 bg-red-900/20 rounded p-2">
                {toolUse.error}
              </div>
            </div>
          )}

          {toolUse.id && (
            <div className="mt-3 pt-2 border-t border-white/10">
              <div className="text-xs text-gray-500 font-mono">
                ID: {toolUse.id.slice(-8)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolVisualization;