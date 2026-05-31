const KEYWORDS: { [key: string]: string } = {
  // Programming Languages
  "javascript": "javascript",
  "typescript": "typescript",
  "python": "python",
  "rust": "rust",
  "golang": "golang",
  "java": "java",
  "ruby": "ruby",
  "php": "php",
  "swift": "swift",
  "kotlin": "kotlin",
  "sql": "sql",
  "c++": "c++",
  "cpp": "c++",
  "c#": "c#",
  
  // Web Frameworks & Libraries
  "react": "react",
  "vue": "vue",
  "angular": "angular",
  "nextjs": "nextjs",
  "vite": "vite",
  "node": "nodejs",
  "express": "nodejs",
  "django": "django",
  "flask": "flask",
  "fastapi": "fastapi",
  "tailwind": "tailwind",
  "html": "html",
  "css": "css",
  
  // Tech & Infrastructure
  "docker": "docker",
  "kubernetes": "kubernetes",
  "aws": "aws",
  "gcp": "gcp",
  "azure": "azure",
  "git": "git",
  "github": "github",
  "figma": "design",
  "sketch": "design",
  "ui": "design",
  "ux": "design",
  
  // Concept & Workflow Keywords
  "bug": "bug",
  "fix": "fix",
  "error": "bug",
  "todo": "todo",
  "task": "todo",
  "idea": "idea",
  "research": "research",
  "recipe": "recipe",
  "article": "article",
  "meeting": "meeting",
  "draft": "draft",
  "refactor": "refactor",
  
  // Advanced Tech
  "ai": "ai",
  "openai": "ai",
  "llm": "ai",
  "machine-learning": "ai",
  "deep-learning": "ai"
};

/**
 * Smart keyword & hashtag extractor that analyzes text and returns a list of unique tags.
 */
export function suggestTags(text: string): string[] {
  if (!text) return [];
  const tagsSet = new Set<string>();

  // 1. Extract raw hashtags (e.g. #todo, #important)
  const hashtagRegex = /\B#([a-zA-Z0-9_-]+)\b/g;
  let match;
  while ((match = hashtagRegex.exec(text)) !== null) {
    tagsSet.add(match[1].toLowerCase());
  }

  // 2. Curated keyword scanner
  const textLower = text.toLowerCase();
  for (const [kw, tag] of Object.entries(KEYWORDS)) {
    const escapedKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let regex: RegExp;
    
    // Use word boundaries for alphabetic strings to avoid partial substring hits
    if (/^[a-zA-Z0-9]+$/.test(kw)) {
      regex = new RegExp(`\\b${escapedKw}\\b`, "i");
    } else {
      regex = new RegExp(escapedKw, "i");
    }

    if (regex.test(textLower)) {
      tagsSet.add(tag);
    }
  }

  return Array.from(tagsSet);
}
