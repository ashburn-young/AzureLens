const express = require('express');
const { getAzureClients, azureConfig } = require('../config/azure');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/chat/analyze
 * Interactive Q&A about image analysis results
 */
router.post('/analyze', async (req, res) => {
  try {
    const { question, analysisResults, conversationHistory = [] } = req.body;
    
    // Validate request
    if (!question || !analysisResults) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: question and analysisResults'
      });
    }

    const { openai } = getAzureClients();
    
    if (!openai) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'OpenAI service not configured'
      });
    }

    // Build context from analysis results
    const analysisContext = buildAnalysisContext(analysisResults);
    
    // Check if we have enhanced analysis results from GPT-4o
    const isEnhancedAnalysis = analysisResults.enhanced && analysisResults.analysis;
    
    // Build conversation messages with enhanced system prompt
    const systemPrompt = isEnhancedAnalysis ? 
      buildEnhancedSystemPrompt(analysisResults) : 
      buildStandardSystemPrompt(analysisContext);
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current question
    messages.push({
      role: 'user',
      content: question
    });

    logger.info('Sending chat request to Azure OpenAI', {
      messageCount: messages.length,
      question: question.substring(0, 100)
    });

    // Call Azure OpenAI
    const response = await openai.chat.completions.create({
      messages: messages,
      max_tokens: azureConfig.openai.maxTokens,
      temperature: azureConfig.openai.temperature,
      stream: false
    });

    const answer = response.choices[0]?.message?.content;
    
    if (!answer) {
      throw new Error('No response received from OpenAI');
    }

    logger.info('Chat response generated successfully');

    res.json({
      question,
      answer,
      timestamp: new Date().toISOString(),
      usage: response.usage
    });

  } catch (error) {
    logger.error('Chat analysis error:', error);
    
    if (error.code === 'insufficient_quota') {
      return res.status(429).json({
        error: 'Quota Exceeded',
        message: 'OpenAI quota exceeded. Please try again later.'
      });
    }
    
    if (error.code === 'content_filter') {
      return res.status(400).json({
        error: 'Content Filtered',
        message: 'Your question was filtered by content policy. Please rephrase.'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process chat request'
    });
  }
});

/**
 * POST /api/chat/suggestions
 * Get suggested questions based on analysis results
 */
router.post('/suggestions', async (req, res) => {
  try {
    const { analysisResults } = req.body;
    
    if (!analysisResults) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: analysisResults'
      });
    }

    // Generate contextual suggestions based on what was detected
    const suggestions = generateQuestionSuggestions(analysisResults);
    
    res.json({
      suggestions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Chat suggestions error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate suggestions'
    });
  }
});

/**
 * Build analysis context string from results
 */
function buildAnalysisContext(results) {
  let context = '';
  
  // Add caption/description
  if (results.caption) {
    context += `Image Description: ${results.caption.text} (confidence: ${results.caption.confidence})\n\n`;
  }
  
  if (results.description?.captions) {
    context += `Detailed Captions:\n`;
    results.description.captions.forEach((cap, i) => {
      context += `- ${cap.text} (confidence: ${cap.confidence})\n`;
    });
    context += '\n';
  }

  // Add objects
  if (results.objects && results.objects.length > 0) {
    context += `Detected Objects:\n`;
    results.objects.forEach(obj => {
      context += `- ${obj.object} at location (${obj.rectangle.x}, ${obj.rectangle.y}) with confidence ${obj.confidence}\n`;
    });
    context += '\n';
  }

  // Add people
  if (results.people && results.people.length > 0) {
    context += `People Detected: ${results.people.length} person(s)\n`;
    results.people.forEach((person, i) => {
      context += `- Person ${i+1} at location (${person.rectangle.x}, ${person.rectangle.y})\n`;
    });
    context += '\n';
  }

  // Add tags
  if (results.tags && results.tags.length > 0) {
    context += `Tags: ${results.tags.map(tag => `${tag.name} (${tag.confidence})`).join(', ')}\n\n`;
  }

  // Add text (OCR)
  if (results.text && results.text.length > 0) {
    context += `Text Found in Image:\n"${results.text.join(' ')}"\n\n`;
  }

  // Add color analysis
  if (results.color) {
    context += `Color Analysis:\n`;
    if (results.color.dominantColorForeground) {
      context += `- Foreground: ${results.color.dominantColorForeground}\n`;
    }
    if (results.color.dominantColorBackground) {
      context += `- Background: ${results.color.dominantColorBackground}\n`;
    }
    if (results.color.dominantColors) {
      context += `- Dominant colors: ${results.color.dominantColors.join(', ')}\n`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Build enhanced system prompt for GPT-4o analyzed images
 */
function buildEnhancedSystemPrompt(analysisResults) {
  const analysis = analysisResults.analysis;
  
  return `You are an engaging, knowledgeable AI assistant helping users explore and understand their image. You have access to a comprehensive AI analysis of the image.

🎯 YOUR PERSONALITY:
- Be conversational, enthusiastic, and insightful
- Use descriptive, vivid language
- Show curiosity and help users discover new details
- Be like a knowledgeable friend sharing insights

📸 IMAGE ANALYSIS DETAILS:
Main Description: ${analysis.mainDescription}
Scene Context: ${analysisResults.sceneContext}
Mood/Atmosphere: ${analysisResults.moodAtmosphere}
Activities: ${analysisResults.activities?.join(', ') || 'None specified'}
Key Objects: ${analysis.objects?.join(', ') || 'None detected'}
Text Content: ${analysisResults.text?.join(' ') || 'No text detected'}
Colors & Composition: ${analysisResults.colorsComposition}
Interesting Details: ${analysisResults.interestingDetails?.join(', ') || 'None noted'}

🎨 YOUR CAPABILITIES:
- Answer questions about what's visible in the image
- Explain the mood, atmosphere, and composition
- Discuss the story or narrative the image tells
- Help identify interesting details users might miss
- Provide context about the setting and activities
- Interpret the artistic or emotional elements

💬 CONVERSATION STYLE:
- Be enthusiastic and descriptive
- Use sensory language when appropriate
- Ask follow-up questions to engage the user
- Share insights that might surprise or delight
- Reference specific details from the analysis
- Be encouraging and positive

Always base responses on the analysis provided. If asked about something not in the analysis, creatively suggest what you can discuss instead.`;
}

/**
 * Build standard system prompt for basic analysis
 */
function buildStandardSystemPrompt(analysisContext) {
  return `You are an AI assistant that helps users understand and explore their image analysis results. 
        
You have access to detailed analysis results from Azure Computer Vision API including:
- Image descriptions and captions
- Detected objects and their locations
- People detection and analysis
- Text recognition (OCR)
- Tags and categories
- Color analysis

Your role is to:
1. Answer questions about what's in the image based on the analysis results
2. Explain the AI analysis in simple, conversational terms
3. Help users discover interesting details they might have missed
4. Provide insights about composition, objects, text, or people in the image
5. Be conversational and engaging while staying accurate to the analysis data

Always base your responses on the provided analysis results. If asked about something not in the analysis, politely explain what information is available.

Here are the current image analysis results:
${analysisContext}`;
}

/**
 * Generate question suggestions based on analysis results
 */
function generateQuestionSuggestions(results) {
  const suggestions = [];
  
  // Check if we have enhanced analysis
  if (results.enhanced && results.analysis) {
    return generateEnhancedSuggestions(results);
  }
  
  // Basic questions for standard analysis
  suggestions.push("What do you see in this image?");
  suggestions.push("Can you describe the main subject?");
  
  // Object-based questions
  if (results.objects && results.objects.length > 0) {
    const objectNames = results.objects.map(obj => obj.object);
    suggestions.push(`Tell me more about the ${objectNames[0]} in the image`);
    if (objectNames.length > 1) {
      suggestions.push("What's the relationship between the objects?");
    }
  }
  
  // People-based questions
  if (results.people && results.people.length > 0) {
    suggestions.push("What can you tell me about the people in the image?");
    if (results.people.length > 1) {
      suggestions.push("How many people are in the image and where are they?");
    }
  }
  
  // Text-based questions
  if (results.text && results.text.length > 0) {
    suggestions.push("What does the text in the image say?");
    suggestions.push("Can you explain the meaning of the text?");
  }
  
  // Color and composition
  suggestions.push("What are the dominant colors?");
  suggestions.push("How would you describe the composition?");
  
  // Context and insights
  suggestions.push("What's the setting or location?");
  suggestions.push("What might be happening in this scene?");
  
  return suggestions.slice(0, 6); // Return top 6 suggestions
}

/**
 * Generate enhanced suggestions for GPT-4o analysis
 */
function generateEnhancedSuggestions(results) {
  const suggestions = [];
  const analysis = results.analysis;
  
  // Story and narrative questions
  if (analysis.mainDescription) {
    suggestions.push("What story does this image tell?");
    suggestions.push("What draws your attention most in this scene?");
  }
  
  // Activity-specific questions
  if (results.activities && results.activities.length > 0) {
    suggestions.push(`Tell me more about the ${results.activities[0]} happening here`);
    suggestions.push("What might happen next in this scene?");
  }
  
  // Mood and atmosphere
  if (results.moodAtmosphere) {
    suggestions.push("How does this image make you feel?");
    suggestions.push("What creates the mood in this image?");
  }
  
  // Interesting details
  if (results.interestingDetails && results.interestingDetails.length > 0) {
    suggestions.push("What's the most interesting detail you notice?");
    suggestions.push("What details might I have missed?");
  }
  
  // Composition and artistic elements
  if (results.colorsComposition) {
    suggestions.push("What makes this image visually appealing?");
    suggestions.push("How do the colors work together?");
  }
  
  // Contextual questions
  if (results.sceneContext) {
    suggestions.push("What does the setting tell us about this moment?");
    suggestions.push("If you were there, what would you notice first?");
  }
  
  return suggestions.slice(0, 6);
}

module.exports = router;
