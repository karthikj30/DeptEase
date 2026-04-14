import React, { useState, useEffect, useRef } from 'react';
import { processAssistantQuery } from '../utils/AssistantEngine';

function AppAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I am your DebtEase Assistant. Ask me anything about your shared expenses!' }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Handle Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Good for Indian accents / Hinglish

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        handleSend(text);
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const handleSend = async (textOverride) => {
    const text = textOverride || input;
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsTyping(true);

    // Process query
    const response = await processAssistantQuery(text);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'bot', text: response }]);
    }, 800);
  };

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  return (
    <div className="ast-wrapper">
      {/* Floating Button */}
      <button className={`ast-fab ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Pane */}
      {isOpen && (
        <div className="ast-pane fade-in">
          <div className="ast-header">
            <h4>DebtEase Assistant</h4>
            <div className="ast-status">Online</div>
          </div>

          <div className="ast-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ast-msg ${m.role}`}>
                <div className="ast-msg-bubble">{m.text}</div>
              </div>
            ))}
            {isTyping && (
              <div className="ast-msg bot">
                <div className="ast-msg-bubble typing">...</div>
              </div>
            )}
          </div>

          <div className="ast-footer">
            <input 
              type="text" 
              placeholder="Ask me something..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className={`ast-mic-btn ${isListening ? 'listening' : ''}`} onClick={toggleMic}>
              {isListening ? '⏺' : '🎤'}
            </button>
            <button className="ast-send-btn" onClick={() => handleSend()}>➔</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppAssistant;
