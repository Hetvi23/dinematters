import json
import re
import logging
from typing import Optional, Dict, List
from datetime import datetime
from collections import Counter
import frappe
from .base import get_openai_client, get_anthropic_client, handle_ai_error

logger = logging.getLogger(__name__)

class VoiceMatcher:
    """Analyzes existing content to match writing voice"""
    
    def __init__(self):
        self.voice_profile = None
    
    def analyze_voice(self, existing_content: List[str]) -> Dict:
        if not existing_content:
            return self._get_default_voice_profile()
        
        all_text = " ".join(existing_content)
        self.voice_profile = {
            "sentence_length": self._analyze_sentence_length(all_text),
            "word_choice": self._analyze_word_choice(all_text),
            "tone": self._analyze_tone(all_text),
            "structure": self._analyze_structure(existing_content),
            "voice_characteristics": self._extract_characteristics(all_text),
        }
        return self.voice_profile
    
    def _analyze_sentence_length(self, text: str) -> Dict:
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        if not sentences: return {"avg": 15, "min": 10, "max": 20}
        lengths = [len(s.split()) for s in sentences]
        return {"avg": sum(lengths) / len(lengths), "min": min(lengths), "max": max(lengths)}
    
    def _analyze_word_choice(self, text: str) -> Dict:
        words = re.findall(r'\b\w+\b', text.lower())
        word_freq = Counter(words)
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be'}
        common_words = [word for word, count in word_freq.most_common(20) if word not in stop_words and len(word) > 3]
        return {"common_words": common_words[:10], "vocabulary_richness": len(set(words)) / len(words) if words else 0}
    
    def _analyze_tone(self, text: str) -> str:
        text_lower = text.lower()
        professional = ['analysis', 'strategy', 'optimize', 'implement', 'efficiency']
        casual = ['awesome', 'great', 'amazing', 'cool']
        technical = ['algorithm', 'api', 'integration', 'architecture']
        p_score = sum(1 for w in professional if w in text_lower)
        c_score = sum(1 for w in casual if w in text_lower)
        t_score = sum(1 for w in technical if w in text_lower)
        if t_score > p_score and t_score > c_score: return "technical"
        return "casual" if c_score > p_score else "professional"

    def _analyze_structure(self, contents: List[str]) -> Dict:
        avg_h2 = sum(len(re.findall(r'<h2>|^## ', c, re.MULTILINE)) for c in contents) / len(contents) if contents else 3
        avg_h3 = sum(len(re.findall(r'<h3>|^### ', c, re.MULTILINE)) for c in contents) / len(contents) if contents else 6
        return {"avg_h2_headings": avg_h2, "avg_h3_headings": avg_h3}

    def _extract_characteristics(self, text: str) -> List[str]:
        chars = []
        if 'we' in text.lower() or 'our' in text.lower(): chars.append("first-person")
        if '!' in text: chars.append("enthusiastic")
        if len(re.findall(r'\d+%', text)) > 3: chars.append("data-driven")
        return chars

    def _get_default_voice_profile(self) -> Dict:
        return {"tone": "professional", "sentence_length": {"avg": 15}, "voice_characteristics": ["professional"], "structure": {"avg_h2_headings": 3, "avg_h3_headings": 6}, "word_choice": {"common_words": []}}

    def generate_voice_prompt(self, base_prompt: str) -> str:
        if not self.voice_profile: return base_prompt
        return base_prompt + f"\n\nMatch style: Tone: {self.voice_profile['tone']}, Avg Sentence: {self.voice_profile['sentence_length']['avg']:.1f}, Chars: {', '.join(self.voice_profile['voice_characteristics'])}"

class ContentGenerator:
    """AI-powered SEO content generation"""
    
    def __init__(self):
        self.openai_client = get_openai_client()
        try: self.anthropic_client = get_anthropic_client()
        except: self.anthropic_client = None
    
    def generate_article(self, keyword: str, title: Optional[str] = None, length: int = 2000, style: str = "professional", language: str = "en", provider: str = "openai", media_urls: List[str] = None, **kwargs) -> Dict:
        """Sequential implementation for Frappe environment"""
        if provider == "openai":
            return self._generate_with_openai(keyword, title, length, style, language, media_urls=media_urls, **kwargs)
        elif provider == "anthropic" and self.anthropic_client:
            return self._generate_with_anthropic(keyword, title, length, style, language, media_urls=media_urls, **kwargs)
        else:
            frappe.throw(f"Provider {provider} not available or configured")

    def _generate_with_openai(self, keyword, title, length, style, language, client_context=None, client_links=None, media_urls=None, **kwargs):
        prompt = self._build_seo_prompt(keyword, title, length, style, client_context, client_links, media_urls)
        response = self.openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an elite SEO content strategist."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=min(length * 2, 4000),
            temperature=0.7,
        )
        content = response.choices[0].message.content.strip()
        if not title: title = self._extract_title_from_content(content, keyword)
        return {
            "title": title, "content": content, "excerpt": self._generate_excerpt(content),
            "word_count": len(content.split()), "keyword": keyword, "language": language, "style": style
        }

    def _generate_with_anthropic(self, keyword, title, length, style, language, client_context=None, client_links=None, media_urls=None, **kwargs):
        if not self.anthropic_client: frappe.throw("Anthropic client not initialized")
        prompt = self._build_seo_prompt(keyword, title, length, style, client_context, client_links, media_urls)
        message = self.anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=min(length * 2, 4096),
            messages=[{"role": "user", "content": prompt}]
        )
        content = message.content[0].text.strip()
        if not title: title = self._extract_title_from_content(content, keyword)
        return {
            "title": title, "content": content, "excerpt": self._generate_excerpt(content),
            "word_count": len(content.split()), "keyword": keyword, "language": language, "style": style
        }

    def generate_premium_metadata(self, content, keyword):
        prompt = f"""Analyze the blog content and generate high-performance SEO metadata for keyword '{keyword}'.
        Requirements:
        1. SEO Title: 50-60 characters, extremely catchy, includes '{keyword}'.
        2. Meta Description: 120-155 characters, high CTR, enticing summary.
        3. Tags: At least 8-10 highly relevant, comma-separated keywords including the neighborhood, city, current year (2026), and dish names.
        
        Output MUST be pure JSON with keys: meta_title, meta_description, tags.
        Content Context: {content[:3000]}"""
        
        response = self.openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a senior SEO specialist. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)

    def _build_seo_prompt(self, keyword, title, length, style, client_context=None, client_links=None, media_urls=None):
        base_prompt = f"""You are a master SEO strategist. Write an industry-leading, premium article for "{keyword}".
        Requirements: Length {max(1500, length)} words, Tone: Authoritative, Professional, and Engaging.
        Structure:
        - H1 Title: Extremely compelling and SEO-optimized.
        - H2 & H3: Use semantic hierarchy. NO literal "H2:" or "H3:" prefixes.
        - Bulleted lists and numbered steps for readability.
        - 2 real-world case studies or "Deep Dives".
        - Final Call to Action (CTA) for Dinematters.
        - Professional Byline: "Dinematters Editorial Team".
        - Author Profile: Brief expert bio at the very end.
        
        IMPORTANT: Use the year 2026 as the current context. Inject a deep understanding of local Mumbai dining trends.
        
        IMAGE INJECTION:
        I am providing a list of real restaurant images. You MUST inject AT LEAST 3 and AT MOST 5 of these images strategically into the sections using standard Markdown: ![Descriptive, SEO-rich Alt Text](URL). Ensure the alt text describes the specific context and includes keywords.
        Available Imagery:
        {"\n".join(media_urls) if media_urls else "No images provided - use text only."}
        
        Content Goals:
        - Hook the reader in the first 50 words with a compelling statistic.
        - Provide actionable steps for restaurant owners.
        - Maintain high keyword density naturally."""
        
        if client_context: base_prompt += f"\n\nContext & Dishes: {client_context[:5000]}"
        if client_links: base_prompt += f"\n\nLinks: {json.dumps(client_links)}"
        return base_prompt

    def _extract_title_from_content(self, content, keyword):
        lines = content.split('\n')
        for line in lines[:5]:
            if line.startswith('# '): return line[2:].strip()
        return f"Complete Guide to {keyword.title()}"

    def _generate_excerpt(self, content, max_length=160):
        text = re.sub(r'<[^>]+>', '', content)
        text = re.sub(r'#', '', text)
        return text.strip()[:max_length] + "..."

    def generate_premium_metadata(self, content, keyword):
        prompt = f"Analyze content and generate SEO Title (50-60 chars), Meta Description (120-155 chars), and a comma-separated list of 5 relevant Tags for keyword '{keyword}'. Content: {content[:2000]}"
        response = self.openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": "You are an SEO specialist. Output JSON only with keys: meta_title, meta_description, tags."}, {"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)

@frappe.whitelist()
def generate_seo_content(keyword, title=None, length=1500, style="professional", provider="openai", context=None):
    """API endpoint for SEO content generation."""
    try:
        gen = ContentGenerator()
        article = gen.generate_article(keyword, title, length, style, provider=provider, client_context=context)
        meta = gen.generate_premium_metadata(article["content"], keyword)
        article.update(meta)
        return {"success": True, "data": article}
    except Exception as e:
        return handle_ai_error(e)
