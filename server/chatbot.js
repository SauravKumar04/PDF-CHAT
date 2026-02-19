import Groq from "groq-sdk";
import readline from "node:readline/promises";
import dotenv from "dotenv";
import { searchDocuments, hasUploadedDoc } from "./prepare.js";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Export function for API usage
export async function getChatResponse(question) {
  try {
    console.log(`🤔 Processing question: ${question}`);
    console.log("🔍 Searching documents...");

    // Search in appropriate document store
    const isUploadedDoc = hasUploadedDoc();
    console.log(`📚 Using ${isUploadedDoc ? 'uploaded document' : 'default documents'}`);

    const relevantDocuments = await searchDocuments(question, 5);

    const context = relevantDocuments
      .map((chunk) => chunk.pageContent)
      .join("\n\n");

    const documentType = isUploadedDoc ? 'your uploaded document' : 'the available documents';
    
    const SYSTEM_PROMPT = `You are a concise document assistant. Provide clear, direct answers from ${documentType}.

Rules:
1. Keep responses short and focused (2-4 sentences max)
2. Answer directly without unnecessary introduction
3. Use simple formatting: **bold** for emphasis, • for bullet points
4. If not in documents, say "Not found in the provided documents"
5. Be conversational but brief

Context: ${context}`;

    const userQuery = `Answer this briefly and directly based on the documents:

${question}`;

    console.log("💭 Generating response...");

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userQuery,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error in getChatResponse:', error);
    throw error;
  }
}

// Keep original chat function for console mode
export async function chat() {
  console.log("🤖 Welcome to CodersGyan Document Chat!");
  console.log("📚 Ask me anything about company policies, procedures, and more.");
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const question = await rl.question("\n💬 Ask a question (or 'exit' to quit): ");

    if (question.toLowerCase() === "exit") {
      console.log("👋 Goodbye!");
      break;
    }

    try {
      const response = await getChatResponse(question);
      console.log("🤖 Answer:", response);
    } catch (error) {
      console.error("Error:", error.message);
    }
  }
  rl.close();
}

// Run console chat only if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  chat();
}
