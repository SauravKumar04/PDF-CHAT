import 'dotenv/config';
import {PDFLoader} from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

// Initialize the Pinecone client and create embeddings
const pinecone = new PineconeClient({apiKey : process.env.PINECONE_API_KEY});
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// Initialize HuggingFace embeddings
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

// Create a vector store for default documents (Pinecone)
export const defaultVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});

// Simple in-memory storage for uploaded documents
let uploadedDocuments = [];
let hasUploadedDocument = false;

// Get the appropriate documents for search
export async function searchDocuments(question, k = 5) {
  if (hasUploadedDocument && uploadedDocuments.length > 0) {
    // Simple text similarity search in uploaded documents
    const lowerQuestion = question.toLowerCase();
    const results = uploadedDocuments
      .map(doc => ({
        ...doc,
        score: calculateSimilarity(lowerQuestion, doc.pageContent.toLowerCase())
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    
    return results;
  } else {
    // Use default vector store
    return await defaultVectorStore.similaritySearch(question, k);
  }
}

// Simple text similarity calculation
function calculateSimilarity(question, text) {
  const questionWords = question.split(/\s+/);
  const textWords = text.split(/\s+/);
  let matches = 0;
  
  questionWords.forEach(qWord => {
    if (textWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))) {
      matches++;
    }
  });
  
  return matches / questionWords.length;
}

// Check if there's an uploaded document
export function hasUploadedDoc() {
  return hasUploadedDocument;
}

// Load and index uploaded PDF document
export async function indexUploadedDocument(filepath) {
    const loader = new PDFLoader(filepath, { splitPages: false });
    const doc = await loader.load();
    console.log('Processing uploaded document:', doc[0].pageContent.substring(0, 200) + '...');

    // Chunk the document into smaller pieces for better retrieval
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 100 })
    const texts = await textSplitter.splitText(doc[0].pageContent)

    const chunkedDocs = texts.map((chunk)=>{
        return {
            pageContent : chunk,
            metadata : { ...doc[0].metadata, source: 'uploaded_document' }
        }
    })

    // Store uploaded documents in memory
    uploadedDocuments = chunkedDocs;
    hasUploadedDocument = true;
    
    console.log(`Indexed ${chunkedDocs.length} chunks from uploaded document`);
}