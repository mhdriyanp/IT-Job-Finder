import { GoogleGenAI, Type } from "@google/genai";
import { Job, UserProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getJobRecommendations(user: UserProfile, jobs: Job[]) {
  try {
    // Check if API key exists
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing. Using local recommendation engine.");
      return getLocalRecommendations(user, jobs);
    }

    const prompt = `
      You are an expert career advisor. Based on the user profile, their past applications, and available jobs, recommend the top 2 most suitable jobs for the user.
      
      User Profile:
      - Name: ${user.name}
      - Qualification: ${user.qualification}
      - Skills: ${user.skills.join(", ")}
      - Past Applied Job IDs: ${user.appliedJobIds.join(", ")}
      
      Available Jobs:
      ${jobs.map(j => `- ID: ${j.id}, Title: ${j.title}, Company: ${j.company}, Skills: ${j.skills.join(", ")}, Description: ${j.description}`).join("\n")}
      
      Matching Logic:
      1. Prioritize jobs that match the user's skills.
      2. Consider the user's past applications to understand their interests.
      3. If they already applied to a job, do not recommend it again, but look for similar roles.
      4. Provide a personalized "matchReason" for each recommendation (max 100 characters).
      5. Calculate a "matchScore" (0-100) based on skill overlap and career path.

      Return a JSON object with a "recommendations" array.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  jobId: { type: Type.STRING },
                  matchReason: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER }
                },
                required: ["jobId", "matchReason", "matchScore"]
              }
            }
          },
          required: ["recommendations"]
        }
      }
    });

    return JSON.parse(response.text || '{"recommendations": []}');
  } catch (error: any) {
    // Check for rate limit or quota errors in various formats
    let errorString = "";
    try {
      errorString = JSON.stringify(error);
    } catch (e) {
      errorString = String(error);
    }

    const errorMessage = error?.message || "";
    const isQuotaError = 
      error?.status === "RESOURCE_EXHAUSTED" || 
      error?.code === 429 ||
      error?.error?.status === "RESOURCE_EXHAUSTED" ||
      error?.error?.code === 429 ||
      errorString.includes("RESOURCE_EXHAUSTED") ||
      errorString.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("429") ||
      errorMessage.includes("quota");

    if (isQuotaError) {
      console.warn("Gemini API quota exceeded or rate limited. Falling back to local recommendation engine.");
    } else {
      console.error("Gemini API error:", error);
    }
    return getLocalRecommendations(user, jobs);
  }
}

function getLocalRecommendations(user: UserProfile, jobs: Job[]) {
  // Filter out jobs already applied to
  const availableJobs = jobs.filter(job => !user.appliedJobIds.includes(job.id));
  
  const recommendations = availableJobs.map(job => {
    // Simple skill matching logic
    const userSkills = new Set(user.skills.map(s => s.toLowerCase()));
    const jobSkills = job.skills.map(s => s.toLowerCase());
    
    const matchingSkills = jobSkills.filter(skill => userSkills.has(skill));
    const matchScore = Math.round((matchingSkills.length / Math.max(jobSkills.length, 1)) * 100);
    
    // Boost score if it's a high-demand skill
    let finalScore = Math.min(matchScore + 10, 98); // Cap at 98 for local matching
    
    let matchReason = "";
    if (matchingSkills.length > 0) {
      matchReason = `Matches your expertise in ${matchingSkills.slice(0, 2).join(" and ")}.`;
    } else {
      matchReason = `Great opportunity to expand your portfolio in ${job.company}.`;
      finalScore = 65; // Baseline score for interesting roles
    }

    return {
      jobId: job.id,
      matchReason,
      matchScore: finalScore
    };
  });

  // Sort by score and take top 2
  return {
    recommendations: recommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 2)
  };
}
