import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChatService, { ChatMessage, AnalysisResults } from '../src/services/chat';

interface ChatInterfaceProps {
  analysisResults: AnalysisResults;
  visible: boolean;
  onClose: () => void;
}

export default function ChatInterface({ analysisResults, visible, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const chatService = ChatService.getInstance();

  useEffect(() => {
    if (visible && analysisResults) {
      loadSuggestions();
      // Add welcome message
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: "Hi! I can help you explore and understand your image analysis. Ask me anything about what's in the image, or tap one of the suggested questions below.",
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    }
  }, [visible, analysisResults]);

  const loadSuggestions = async () => {
    try {
      const suggestions = await chatService.getSuggestions(analysisResults);
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await chatService.askQuestion(
        text.trim(),
        analysisResults,
        messages
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.answer,
        timestamp: response.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('quota exceeded')) {
          errorMessage = 'AI service quota exceeded. Please try again later.';
        } else if (error.message.includes('Content Filtered')) {
          errorMessage = 'Your question was filtered by content policy. Please rephrase.';
        } else if (error.message.includes('API URL not configured')) {
          errorMessage = 'Configuration error. Please contact support.';
        } else if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      const errorChatMessage: ChatMessage = {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorChatMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ask about your image</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#0078d4" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageContainer,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === 'user' ? styles.userMessageText : styles.assistantMessageText
              ]}
            >
              {message.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                message.role === 'user' ? styles.userMessageTime : styles.assistantMessageTime
              ]}
            >
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#0078d4" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Suggested questions:</Text>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionButton}
                onPress={() => handleSuggestionPress(suggestion)}
                disabled={isLoading}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
            
            {/* Visual separator */}
            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>or ask your own question</Text>
              <View style={styles.separatorLine} />
            </View>
          </View>
        )}
        
        {/* Always visible custom question section */}
        {showSuggestions && (
          <View style={styles.customQuestionContainer}>
            <Text style={styles.customQuestionTitle}>Ask your own question:</Text>
            <View style={styles.customQuestionInputContainer}>
              <TextInput
                style={styles.customQuestionInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type anything you want to know about this image..."
                placeholderTextColor="#999"
                multiline
                maxLength={500}
                editable={!isLoading}
                onSubmitEditing={() => {
                  if (inputText.trim()) {
                    sendMessage(inputText);
                  }
                }}
              />
              <TouchableOpacity
                style={[
                  styles.customQuestionSendButton,
                  (!inputText.trim() || isLoading) && styles.sendButtonDisabled
                ]}
                onPress={() => sendMessage(inputText)}
                disabled={!inputText.trim() || isLoading}
              >
                <Ionicons 
                  name="send" 
                  size={18} 
                  color={(!inputText.trim() || isLoading) ? '#ccc' : '#fff'} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your question here..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={(!inputText.trim() || isLoading) ? '#ccc' : '#fff'} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 100,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0078d4',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  assistantMessageTime: {
    color: '#999',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  loadingText: {
    color: '#666',
    marginLeft: 8,
    fontSize: 14,
  },
  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  suggestionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  suggestionText: {
    fontSize: 14,
    color: '#0078d4',
    lineHeight: 18,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#0078d4',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e9ecef',
  },
  separatorText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  customQuestionContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  customQuestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  customQuestionInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  customQuestionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    maxHeight: 80,
    minHeight: 40,
  },
  customQuestionSendButton: {
    backgroundColor: '#0078d4',
    borderRadius: 12,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
