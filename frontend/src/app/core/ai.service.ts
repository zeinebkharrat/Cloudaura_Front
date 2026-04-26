import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  
  private getBackendUrl(): string {
    return `/api/ai/groq/chat`;
  }

  private extractJson(content: string): any {
    try {
      // Try parsing directly first
      return JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch (e2) {
          console.error("Failed to parse JSON from code block", e2);
        }
      }
      
      // Try to find the first '{' and last '}'
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        try {
          return JSON.parse(content.substring(firstBrace, lastBrace + 1));
        } catch (e3) {
          console.error("Failed to parse JSON from braces", e3);
        }
      }
      
      throw new Error("Could not extract valid JSON from AI response");
    }
  }

  generateDailyChallenge(gameKind: string): Observable<{ title: string; description: string; points: number }> {
    const randomTopic = ['history', 'food', 'landmarks', 'culture', 'geography', 'music'][Math.floor(Math.random() * 6)];
    const randomSeed = Math.floor(Math.random() * 10000);
    const prompt = `Generate a daily challenge for a travel and gamification app about Tunisia. 
    The game type is ${gameKind}. Focus on the topic: ${randomTopic}.
    Provide a title (short, catchy, in English, MUST be unique like "Challenge ${randomSeed}"), a description (engaging, explain what to do, in English), and a suggested point reward (between 10 and 50).
    Return ONLY a JSON object with keys: title, description, points.
    Do not include any other text.
    Example: {"title": "Carthage Master ${randomSeed}", "description": "Complete the Carthage quiz with 100% accuracy.", "points": 25}`;

    const body: any = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    };

    return this.http.post<any>(this.getBackendUrl(), body).pipe(
      map(res => {
        try {
          const content = this.extractJson(res.choices[0].message.content);
          return {
            title: content.title || '',
            description: content.description || '',
            points: content.points || 10
          };
        } catch (e) {
          console.error(`Failed to parse Groq response`, e);
          return { title: 'AI Challenge', description: 'Complete a game today!', points: 15 };
        }
      })
    );
  }

  getHelpForChallenge(challenge: any): Observable<string> {
    const prompt = `The user is looking at a daily challenge for a Tunisian travel app.
    Challenge: "${challenge.title}"
    Description: "${challenge.description}"
    Game Type: ${challenge.gameKind}
    
    Give a very short, witty, and helpful hint or "AI perspective" on how to approach this.
    Maximum 2 sentences. Be engaging!`;

    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    };

    return this.http.post<any>(this.getBackendUrl(), body).pipe(
      map(res => res.choices[0].message.content)
    );
  }

  getCustomResponse(prompt: string): Observable<string> {
    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    };

    return this.http.post<any>(this.getBackendUrl(), body).pipe(
      map(res => res.choices[0].message.content)
    );
  }

  generateFullQuiz(topic: string): Observable<any> {
    const randomSeed = Math.floor(Math.random() * 10000);
    const prompt = `You are a strict JSON API. Generate a full quiz about "${topic}" for a Tunisian travel app.
    Ensure the title is unique (e.g. append #${randomSeed} to it).
    You MUST return ONLY a raw JSON object and nothing else. No markdown, no explanations.
    The JSON object MUST have this exact structure:
    {
      "title": "A short title for the quiz",
      "description": "A short description",
      "questions": [
        {
          "questionText": "The question string",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctOptionIndex": 0
        }
      ]
    }
    Generate exactly 5 questions. Do not include any extra keys.`;

    const body: any = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    };

    return this.http.post<any>(this.getBackendUrl(), body).pipe(
      map(res => {
        return this.extractJson(res.choices[0].message.content);
      })
    );
  }
}
