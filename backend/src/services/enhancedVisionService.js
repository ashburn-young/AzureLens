const { getAzureClients, azureConfig } = require('../config/azure');
const logger = require('../utils/logger');

/**
 * Enhanced Vision Analysis Service using GPT-4o
 * Provides more detailed and contextual image analysis
 */
class EnhancedVisionService {
  constructor() {
    this.clients = getAzureClients();
    this.config = azureConfig;
  }

  /**
   * Analyze image with GPT-4o for enhanced, conversational results
   */
  async analyzeImageWithGPT4o(imageBuffer, mimeType = 'image/jpeg') {
    try {
      if (!this.clients.openai) {
        throw new Error('OpenAI client not initialized');
      }

      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');
      const imageUrl = `data:${mimeType};base64,${base64Image}`;

      logger.info('Starting enhanced image analysis with GPT-4o');

      // Create a comprehensive prompt for better analysis
      const analysisPrompt = `
You are an expert image analyst. Please analyze this image in detail and provide:

1. **Main Description**: A rich, engaging description of what you see (2-3 sentences)
2. **Key Objects**: List all important objects, people, animals, or items you can identify
3. **Scene Context**: Describe the setting, environment, or context (indoor/outdoor, time of day, weather, etc.)
4. **Activities**: What activities or actions are happening in the image?
5. **Mood/Atmosphere**: What mood or feeling does the image convey?
6. **Text Content**: Any text, signs, or writing visible in the image
7. **Colors & Composition**: Notable colors, lighting, and visual composition
8. **Interesting Details**: Any unique, unusual, or noteworthy details

Please make your analysis engaging and conversational, as if you're describing the image to a friend. Be thorough but natural in your description.

Format your response as a JSON object with these fields:
- mainDescription: string
- objects: array of strings
- sceneContext: string
- activities: array of strings
- moodAtmosphere: string
- textContent: string
- colorsComposition: string
- interestingDetails: array of strings
- confidence: number (0-1)
`;

      const response = await this.clients.openai.chat.completions.create({
        model: this.config.openai.deploymentName,
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: analysisPrompt 
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "high" // High detail for better analysis
                }
              }
            ]
          }
        ],
        max_tokens: this.config.openai.maxTokens,
        temperature: this.config.openai.temperature,
        response_format: { type: "json_object" }
      });

      const analysisResult = JSON.parse(response.choices[0].message.content);
      
      logger.info('Enhanced image analysis completed', {
        tokensUsed: response.usage?.total_tokens,
        confidence: analysisResult.confidence
      });

      // Transform to our expected format while preserving rich data
      return {
        enhanced: true,
        model: 'gpt-4o',
        analysis: analysisResult,
        // Legacy format for compatibility
        caption: {
          text: analysisResult.mainDescription,
          confidence: analysisResult.confidence || 0.9
        },
        description: {
          captions: [{
            text: analysisResult.mainDescription,
            confidence: analysisResult.confidence || 0.9
          }]
        },
        objects: analysisResult.objects?.map((obj, index) => ({
          object: obj,
          confidence: 0.85,
          rectangle: { x: 0, y: 0, w: 100, h: 100 } // Placeholder
        })) || [],
        tags: [
          ...analysisResult.objects?.map(obj => ({ name: obj, confidence: 0.85 })) || [],
          ...analysisResult.activities?.map(activity => ({ name: activity, confidence: 0.8 })) || []
        ],
        text: analysisResult.textContent ? [analysisResult.textContent] : [],
        color: {
          dominantColors: analysisResult.colorsComposition?.split(',').map(c => c.trim()).slice(0, 3) || []
        },
        // Enhanced fields
        sceneContext: analysisResult.sceneContext,
        activities: analysisResult.activities || [],
        moodAtmosphere: analysisResult.moodAtmosphere,
        colorsComposition: analysisResult.colorsComposition,
        interestingDetails: analysisResult.interestingDetails || [],
        usage: response.usage
      };

    } catch (error) {
      logger.error('Enhanced vision analysis failed:', error);
      throw new Error(`Enhanced vision analysis failed: ${error.message}`);
    }
  }

  /**
   * Generate contextual conversation starters based on the enhanced analysis
   */
  async generateEnhancedSuggestions(analysisResult) {
    try {
      if (!this.clients.openai || !analysisResult.enhanced) {
        // Fallback to basic suggestions
        return [
          "What do you see in this image?",
          "Can you describe the main subject?",
          "What's the mood of this image?",
          "Tell me about the colors and composition"
        ];
      }

      const suggestionPrompt = `
Based on this detailed image analysis, create 4-5 engaging conversation starter questions that would be interesting to ask about this image. Make them specific to what's actually in the image, not generic.

Image Analysis:
- Main Description: ${analysisResult.analysis.mainDescription}
- Scene Context: ${analysisResult.sceneContext}
- Activities: ${analysisResult.activities?.join(', ')}
- Mood: ${analysisResult.moodAtmosphere}
- Objects: ${analysisResult.analysis.objects?.join(', ')}
- Interesting Details: ${analysisResult.interestingDetails?.join(', ')}

Create questions that are:
- Specific to this image's content
- Engaging and conversational
- Encourage deeper exploration
- Vary in type (descriptive, analytical, interpretive)

Return as a JSON object with a "suggestions" array of strings.
`;

      const response = await this.clients.openai.chat.completions.create({
        model: this.config.openai.deploymentName,
        messages: [
          { role: "user", content: suggestionPrompt }
        ],
        max_tokens: 500,
        temperature: 0.8,
        response_format: { type: "json_object" }
      });

      const suggestions = JSON.parse(response.choices[0].message.content);
      
      logger.info('Enhanced suggestions generated', {
        count: suggestions.suggestions?.length
      });

      return suggestions.suggestions || [
        "What story does this image tell?",
        "How does this image make you feel?",
        "What's the most interesting detail you notice?",
        "What might have happened before this moment?"
      ];

    } catch (error) {
      logger.error('Enhanced suggestions generation failed:', error);
      // Fallback suggestions
      return [
        "What's the story behind this image?",
        "What draws your attention most?",
        "How would you describe the atmosphere?",
        "What details stand out to you?"
      ];
    }
  }
}

module.exports = EnhancedVisionService;
