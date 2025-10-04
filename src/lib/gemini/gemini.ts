import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '~/env'

const apiKey = env.GEMINI_API_KEY
if (!apiKey) {
  // Log the error but don't throw here, allow the app to potentially start
  // Errors will occur when the model is actually used
  console.error('GEMINI_API_KEY environment variable is not set.')
}

// Initialize the client only if the API key exists
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

// Export the model instance, making it potentially null if API key is missing
export const geminiFlashModel = genAI
  ? genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  : null

// Example usage function (optional, for testing purposes)
/* 
async function exampleUsage() {
  if (!geminiFlashModel) {
    console.error("Gemini model not initialized. Check API key.");
    return;
  }
  try {
    const result = await geminiFlashModel.generateContent("Explain how AI works in a few words");
    const response = result.response;
    const text = response.text();
    console.log(text);
  } catch (error) {
    console.error("Error generating content:", error);
  }
}
// exampleUsage(); // Don't call this directly in the module
*/
