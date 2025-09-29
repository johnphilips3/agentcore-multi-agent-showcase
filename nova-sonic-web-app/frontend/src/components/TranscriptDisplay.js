import React, { useEffect, useRef } from 'react';
import { MessageSquare, Trash2, User, Bot, Settings } from 'lucide-react';

const TranscriptDisplay = ({ transcript, onClear }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const getMessageIcon = (role) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4 text-blue-400" />;
      case 'assistant':
        return <Bot className="h-4 w-4 text-green-400" />;
      case 'system':
        return <Settings className="h-4 w-4 text-yellow-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-400" />;
    }
  };

  const getMessageStyle = (role) => {
    switch (role) {
      case 'user':
        return 'bg-blue-900/20 border-blue-500/30 text-blue-100';
      case 'assistant':
        return 'bg-green-900/20 border-green-500/30 text-green-100';
      case 'system':
        return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-100';
      default:
        return 'bg-gray-900/20 border-gray-500/30 text-gray-100';
    }
  };

  const formatContent = (content) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-black/30 px-1 rounded text-xs">$1</code>');
  };

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-white" />
          <h3 className="text-lg font-semibold text-white">Conversation</h3>
          {transcript.length > 0 && (
            <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full">
              {transcript.length}
            </span>
          )}
        </div>
        
        {transcript.length > 0 && (
          <button
            onClick={onClear}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title="Clear transcript"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {transcript.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Your conversation will appear here</p>
            <p className="text-sm mt-1">Start a session and begin speaking</p>
          </div>
        ) : (
          transcript.map((message) => (
            <div
              key={message.id}
              className={`border rounded-lg p-3 ${getMessageStyle(message.role)}`}
            >
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {getMessageIcon(message.role)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-medium capitalize">
                      {message.role}
                    </span>
                    <span className="text-xs opacity-60">
                      {message.timestamp}
                    </span>
                  </div>
                  <div 
                    className="text-sm leading-relaxed break-words"
                    dangerouslySetInnerHTML={{ 
                      __html: formatContent(message.content) 
                    }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {transcript.length > 0 && (
        <div className="p-3 border-t border-white/10 bg-black/10">
          <div className="text-xs text-gray-400 text-center">
            {transcript.length} message{transcript.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptDisplay;