import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { IoSend, IoDocumentText } from 'react-icons/io5';
import { FaUser, FaRobot, FaFile, FaUpload, FaCheckCircle, FaHistory, FaPlus, FaTrash, FaBars, FaCrown } from 'react-icons/fa';
import { HiChat, HiSparkles } from 'react-icons/hi';
import { BiMessageRounded } from 'react-icons/bi';

// Component to format bot messages with better styling
const FormattedBotMessage = ({ content }) => {
  const formatContent = (text) => {
    // Process markdown-style formatting
    let processedText = text
      // Convert **bold** to <strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert *italic* to <em>
      .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
      // Convert numbered lists
      .replace(/^(\d+\.)\s+(.+)$/gm, '<li class="numbered-item">$2</li>')
      // Convert bullet points
      .replace(/^[-•*]\s+(.+)$/gm, '<li class="bullet-item">• $1</li>')
      // Convert headers (lines ending with :)
      .replace(/^(.+):$/gm, '<h4 class="header-item">$1:</h4>');
    
    return processedText;
  };

  return (
    <div 
      className="formatted-message"
      dangerouslySetInnerHTML={{ 
        __html: formatContent(content)
          .split('\n')
          .map(line => {
            if (line.includes('numbered-item')) {
              return `<div class="mb-1 ml-4">${line}</div>`;
            }
            if (line.includes('bullet-item')) {
              return `<div class="mb-1 ml-2 text-rose-600">${line}</div>`;
            }
            if (line.includes('header-item')) {
              return `<div class="font-semibold text-rose-700 mt-2 mb-1">${line}</div>`;
            }
            if (line.trim()) {
              return `<p class="mb-2 leading-relaxed">${line}</p>`;
            }
            return '';
          })
          .join('')
      }}
    />
  );
};

const App = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: 'Welcome to your elegant document assistant. Upload a PDF document or inquire about previously uploaded documents to begin our conversation.',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/sessions');
      setSessions(response.data);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await axios.post('http://localhost:3001/api/sessions');
      const newSession = response.data;
      
      setCurrentSessionId(newSession.id);
      setMessages([
        {
          id: 1,
          type: 'bot',
          content: 'Welcome to your elegant document assistant. Upload a PDF document or inquire about previously uploaded documents to begin our conversation.',
          timestamp: new Date()
        }
      ]);
      
      await loadChatHistory();
    } catch (error) {
      console.error('Error creating new session:', error);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/sessions/${sessionId}`);
      const session = response.data;
      
      setCurrentSessionId(sessionId);
      setMessages(session.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })));
      
      setShowHistory(false);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    
    try {
      await axios.delete(`http://localhost:3001/api/sessions/${sessionId}`);
      
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([
          {
            id: 1,
            type: 'bot',
            content: 'Welcome to your elegant document assistant. Upload a PDF document or inquire about previously uploaded documents to begin our conversation.',
            timestamp: new Date()
          }
        ]);
      }
      
      await loadChatHistory();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    // Check if document is uploaded before processing
    if (!uploadedFile) {
      const noDocMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Please upload a PDF document first before asking questions. Use the "Upload Document" button above to get started.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, noDocMessage]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:3001/api/chat', {
        message: inputMessage.trim(),
        sessionId: currentSessionId
      });

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: response.data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Update session ID if it was created by the server
      if (!currentSessionId && response.data.sessionId) {
        setCurrentSessionId(response.data.sessionId);
        await loadChatHistory();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file only.');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    setIsUploading(true);

    try {
      const response = await axios.post('http://localhost:3001/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadedFile(file.name);
      
      // Add success message
      const successMessage = {
        id: Date.now(),
        type: 'document-upload',
        content: `${file.name}`,
        fileName: file.name,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, successMessage]);
      
    } catch (error) {
      console.error('Upload error:', error);
      
      const errorMessage = {
        id: Date.now(),
        type: 'bot',
        content: 'Sorry, failed to upload the document. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex relative">
      {/* Chat History Sidebar */}
      {showHistory && (
        <div className="fixed inset-y-0 left-0 z-50 w-full sm:w-80 bg-white/95 border-r border-gray-200 backdrop-blur-sm flex flex-col shadow-lg md:relative md:inset-auto md:z-auto">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center">
                <FaHistory className="mr-2 text-rose-600" />
                Chat History
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg md:p-1"
              >
                ×
              </button>
            </div>
            <button
              onClick={createNewSession}
              className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg text-sm sm:text-base"
            >
              <FaPlus className="w-4 h-4" />
              <span>New Conversation</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No conversations yet</p>
            ) : (
              sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all group ${
                    currentSessionId === session.id
                      ? 'bg-rose-50 border border-rose-200 shadow-sm'
                      : 'hover:bg-gray-50 border border-transparent hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 text-xs sm:text-sm font-medium truncate flex items-center">
                        <BiMessageRounded className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-rose-600" />
                        {session.title}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {session.messageCount} messages • {new Date(session.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 ml-2 transition-all hover:bg-red-50 rounded"
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
              >
                <FaBars className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-rose-600 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                <FaCrown className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 tracking-tight flex items-center">
                  <HiSparkles className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 mr-1 sm:mr-1.5 md:mr-2 text-rose-600" />
                  <span className="hidden sm:inline">Document Assistant</span>
                  <span className="sm:hidden">Assistant</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {uploadedFile ? (
                    <span className="flex items-center">
                      <IoDocumentText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-rose-600" />
                      <span className="truncate">{uploadedFile}</span>
                    </span>
                  ) : currentSessionId ? (
                    <span className="truncate">{sessions.find(s => s.id === currentSessionId)?.title || 'Current Conversation'}</span>
                  ) : (
                    <span className="hidden sm:inline">Your intelligent document companion</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Upload button removed from header - now in input area */}
            </div>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-50 to-white pb-20 sm:pb-24 md:pb-28">
        <div className="max-w-5xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 md:space-y-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === 'document-upload' 
                    ? 'justify-center' 
                    : message.type === 'user' 
                    ? 'justify-end' 
                    : 'justify-start'
                }`}
              >
                {/* Special rendering for document upload */}
                {message.type === 'document-upload' ? (
                  <div className="max-w-md w-full">
                    <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg relative overflow-hidden">
                      {/* Decorative background pattern */}
                      <div className="absolute inset-0 opacity-5">
                        <div className="absolute top-2 right-2 w-16 h-16 bg-rose-300 rounded-full"></div>
                        <div className="absolute bottom-2 left-2 w-12 h-12 bg-pink-300 rounded-full"></div>
                      </div>
                      
                      {/* Content */}
                      <div className="relative z-10">
                        <div className="flex items-center justify-center mb-3">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-rose-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
                            <FaCheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Document Uploaded Successfully!</h3>
                          
                          <div className="bg-white/80 rounded-lg p-3 mb-3 border border-rose-100">
                            <div className="flex items-center justify-center space-x-2 text-gray-700">
                              <IoDocumentText className="w-5 h-5 text-rose-600" />
                              <span className="font-medium text-sm sm:text-base truncate">{message.fileName}</span>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-600 leading-relaxed">
                            Your document is ready for questions. Start asking anything about the content!
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Timestamp */}
                    <div className="text-center mt-2">
                      <span className="text-xs text-gray-500">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Regular message rendering */
                  <div className={`flex max-w-full sm:max-w-3xl md:max-w-4xl ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 ${message.type === 'user' ? 'ml-2 sm:ml-3 md:ml-4' : 'mr-2 sm:mr-3 md:mr-4'}`}>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-br from-rose-600 to-pink-600' 
                        : 'bg-gradient-to-br from-gray-700 to-gray-600'
                    }`}>
                      {message.type === 'user' ? (
                        <FaUser className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
                      ) : (
                        <FaRobot className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
                      )}
                    </div>
                  </div>
                  
                  {/* Message Bubble */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className={`rounded-xl sm:rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5 md:px-6 md:py-4 shadow-lg backdrop-blur-sm ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800 shadow-md'
                    }`}>
                      <div className="text-xs sm:text-sm leading-relaxed">
                        {message.type === 'bot' ? (
                          <FormattedBotMessage content={message.content} />
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs text-gray-500 mt-2 ${
                      message.type === 'user' ? 'text-right' : 'text-left'
                    }`}>
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-full sm:max-w-3xl md:max-w-4xl">
                  <div className="flex-shrink-0 mr-2 sm:mr-3 md:mr-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-gradient-to-br from-gray-700 to-gray-600 rounded-full flex items-center justify-center shadow-lg">
                      <FaRobot className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5 md:px-6 md:py-4 shadow-md">
                    <div className="flex space-x-1.5 sm:space-x-2 items-center">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-500 rounded-full"></div>
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-400 rounded-full"></div>
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-300 rounded-full"></div>
                      <span className="text-gray-600 text-xs sm:text-sm ml-1.5 sm:ml-2">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Input Area - Fixed at bottom */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 border-t border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 backdrop-blur-sm shadow-lg z-40">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={sendMessage} className="flex items-center space-x-2 sm:space-x-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-shrink-0 p-2 sm:p-2.5 md:p-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 rounded-lg sm:rounded-xl text-white transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed"
              title={isUploading ? 'Processing...' : 'Upload Document'}
            >
              {isUploading ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaUpload className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
            
            {/* Input field */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                placeholder="Share your thoughts about the documents..."
                className="w-full bg-gray-50 border border-gray-300 rounded-xl sm:rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5 md:px-6 md:py-4 pr-12 sm:pr-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent disabled:opacity-50 shadow-sm transition-all hover:border-gray-400 text-sm sm:text-base"
              />
              
              {/* Send button */}
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 transition-all shadow-md hover:shadow-lg"
              >
                <IoSend className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </button>
            </div>
          </form>
          
          {/* Status text */}
          <div className="mt-2 sm:mt-3 text-center">
            <p className="text-xs text-gray-500 flex items-center justify-center">
              <HiSparkles className="inline w-3 h-3 mr-1 text-rose-500" />
              <span className="hidden sm:inline">Powered by Advanced AI Technology</span>
              <span className="sm:hidden">AI Powered</span>
            </p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default App;
