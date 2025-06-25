import { Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatAnalyzeResponse {
  question: string;
  answer: string;
  timestamp: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatSuggestionsResponse {
  suggestions: string[];
  timestamp: string;
}

export interface AnalysisResults {
  caption?: {
    text: string;
    confidence: number;
  };
  description?: {
    captions: Array<{ text: string; confidence: number }>;
  };
  objects?: Array<{
    object: string;
    confidence: number;
    rectangle: { x: number; y: number; w: number; h: number };
  }>;
  people?: Array<{
    rectangle: { x: number; y: number; w: number; h: number };
  }>;
  tags?: Array<{
    name: string;
    confidence: number;
  }>;
  text?: string[];
  color?: {
    dominantColorForeground?: string;
    dominantColorBackground?: string;
    dominantColors?: string[];
  };
  // Enhanced analysis fields (from GPT-4o)
  enhanced?: boolean;
  analysis?: {
    mainDescription?: string;
    objects?: string[];
    confidence?: number;
  };
  sceneContext?: string;
  activities?: string[];
  moodAtmosphere?: string;
  colorsComposition?: string;
  interestingDetails?: string[];
}

class ChatService {
  private static instance: ChatService;
  
  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  /**
   * Ask a question about the analysis results
   */
  async askQuestion(
    question: string,
    analysisResults: AnalysisResults,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatAnalyzeResponse> {
    try {
      if (!API_URL) {
        throw new Error('API URL not configured');
      }

      if (!question.trim()) {
        throw new Error('Question cannot be empty');
      }

      console.log('Sending chat question:', {
        question: question.substring(0, 100),
        hasAnalysisResults: !!analysisResults,
        historyLength: conversationHistory.length,
        apiUrl: `${API_URL}/api/chat/analyze`
      });

      const requestBody = {
        question,
        analysisResults,
        conversationHistory
      };

      console.log('Request body structure:', {
        hasQuestion: !!requestBody.question,
        hasAnalysisResults: !!requestBody.analysisResults,
        analysisResultsKeys: requestBody.analysisResults ? Object.keys(requestBody.analysisResults) : [],
        historyLength: requestBody.conversationHistory.length
      });

      const response = await fetch(`${API_URL}/api/chat/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error('AI service quota exceeded. Please try again later.');
        }
        
        if (response.status === 400 && errorData.error === 'Content Filtered') {
          throw new Error('Your question was filtered by content policy. Please rephrase.');
        }
        
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data: ChatAnalyzeResponse = await response.json();
      
      console.log('Chat response received:', {
        answerLength: data.answer?.length || 0,
        usage: data.usage
      });

      return data;
    } catch (error) {
      console.error('Chat question error:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to get answer. Please check your connection and try again.');
    }
  }

  /**
   * Get suggested questions based on analysis results
   */
  async getSuggestions(analysisResults: AnalysisResults): Promise<string[]> {
    try {
      if (!API_URL) {
        throw new Error('API URL not configured');
      }

      console.log('Getting chat suggestions for analysis results');

      const response = await fetch(`${API_URL}/api/chat/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisResults
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data: ChatSuggestionsResponse = await response.json();
      
      console.log('Chat suggestions received:', {
        count: data.suggestions?.length || 0
      });

      return data.suggestions || [];
    } catch (error) {
      console.error('Chat suggestions error:', error);
      
      // Return fallback suggestions if service fails
      return [
        "What do you see in this image?",
        "Can you describe the main subject?",
        "What are the dominant colors?",
        "What's happening in this scene?"
      ];
    }
  }

  /**
   * Show error alert
   */
  showError(title: string, message: string) {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }
}

export default ChatService;
