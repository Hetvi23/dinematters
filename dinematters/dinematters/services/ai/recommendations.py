import logging
import math
import json
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict
import frappe
from .base import get_openai_client, handle_ai_error

logger = logging.getLogger(__name__)

class RecommendationEngine:
    """Generate menu item recommendations."""

    def __init__(self, embedding_model: str = "text-embedding-3-small"):
        self.client = get_openai_client()
        self.embedding_model = embedding_model

    def generate_recommendations(
        self,
        dishes: List[Dict[str, Any]],
        categories: Optional[List[Dict[str, Any]]] = None,
        min_recommendations: int = 9,
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Generate deterministic recommendations for each dish.
        """
        if not dishes:
            return [], []

        dish_embeddings = self._build_embeddings(dishes)
        dish_map = {dish.get("id"): dish for dish in dishes if dish.get("id")}
        categories_by_id = {c.get("id"): c for c in categories or [] if c.get("id")}

        results = []
        insufficient: List[str] = []

        for dish in dishes:
            dish_id = dish.get("id")
            if not dish_id:
                continue

            candidates = []
            for other_id, other_dish in dish_map.items():
                if other_id == dish_id:
                    continue
                sim = self._cosine(
                    dish_embeddings.get(dish_id, []),
                    dish_embeddings.get(other_id, []),
                )
                score = self._score_pair(dish, other_dish, sim)
                candidates.append((score, other_dish, sim))

            # Sort deterministically
            candidates.sort(key=lambda item: (-item[0], item[1].get("id", "")))

            # Enforce diversity
            top_candidates = self._select_diverse_candidates(
                base_dish=dish,
                candidates=candidates,
                min_recommendations=min_recommendations,
                base_embedding=dish_embeddings.get(dish_id, []),
                embeddings=dish_embeddings,
            )

            if len(top_candidates) < min_recommendations:
                insufficient.append(dish_id)

            recs = []
            for score, cand, sim in top_candidates[: min_recommendations]:
                recs.append({
                    "id": cand.get("id"),
                    "name": cand.get("name"),
                    "category": cand.get("category"),
                    "mainCategory": cand.get("mainCategory"),
                    "isVegetarian": cand.get("isVegetarian", False),
                    "price": cand.get("price"),
                    "reason": self._build_reason(dish, cand, categories_by_id, sim),
                    "score": round(score, 4),
                })

            results.append({
                "id": dish_id,
                "name": dish.get("name"),
                "category": dish.get("category"),
                "mainCategory": dish.get("mainCategory"),
                "isVegetarian": dish.get("isVegetarian", False),
                "recommendations": recs,
            })

        return results, insufficient

    def _build_embeddings(self, dishes: List[Dict[str, Any]]) -> Dict[str, List[float]]:
        """Create embeddings for each dish."""
        inputs = []
        ids = []
        for dish in dishes:
            dish_id = dish.get("id")
            if not dish_id:
                continue
            ids.append(dish_id)
            inputs.append(self._dish_to_text(dish))

        if not inputs:
            return {}

        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=inputs,
        )

        embeddings = {}
        for dish_id, emb in zip(ids, response.data):
            embeddings[dish_id] = emb.embedding

        return embeddings

    def _dish_to_text(self, dish: Dict[str, Any]) -> str:
        """Compact text representation for embedding."""
        name = dish.get("name", "")
        category = dish.get("category", "")
        main_category = dish.get("mainCategory", "")
        description = dish.get("description") or ""
        veg = "vegetarian" if dish.get("isVegetarian") else "non-vegetarian"
        price = dish.get("price", "")
        return (
            f"Dish: {name}. Category: {category}. Main category: {main_category}. "
            f"Type: {veg}. Price: {price}. Description: {description}"
        )

    def _cosine(self, a: List[float], b: List[float]) -> float:
        """Cosine similarity."""
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(y * y for y in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _score_pair(self, base: Dict[str, Any], candidate: Dict[str, Any], similarity: float) -> float:
        """Heuristic scoring."""
        base_category = (base.get("category") or "").lower()
        cand_category = (candidate.get("category") or "").lower()
        base_main = (base.get("mainCategory") or "").lower()
        cand_main = (candidate.get("mainCategory") or "").lower()

        price_base = base.get("price") or 0
        price_cand = candidate.get("price") or 0
        price_gap = abs(price_base - price_cand)
        price_norm = 1 - min(price_gap / (max(price_base, price_cand, 1)), 1)

        dietary_penalty = -0.2 if base.get("isVegetarian") and not candidate.get("isVegetarian") else 0.0
        category_bonus = 0.15 if base_category != cand_category else 0.0
        main_bonus = 0.1 if base_main != cand_main else 0.0
        beverage_bonus = 0.1 if "beverage" in cand_main and base_main != cand_main else 0.0
        dessert_bonus = 0.08 if "dessert" in cand_main and base_main != cand_main else 0.0
        offer_bonus = 0.05 if candidate.get("originalPrice") and candidate.get("originalPrice") > candidate.get("price", 0) else 0.0
        
        # Popularity & Business bonuses
        pop_boost = 0.0
        if candidate.get("isSpecial"): pop_boost += 0.05
        if "special" in cand_category or "top" in cand_category: pop_boost += 0.03
        
        biz_bonus = (0.05 * min(1.0, candidate.get("priorityWeight") or 0) + 
                     0.03 * min(1.0, candidate.get("popularityScore") or 0))

        return (0.6 * similarity + 0.15 * price_norm + category_bonus + main_bonus + 
                beverage_bonus + dessert_bonus + offer_bonus + pop_boost + biz_bonus + dietary_penalty)

    def _build_reason(self, base: Dict[str, Any], candidate: Dict[str, Any], categories_by_id: Dict[str, Dict[str, Any]], similarity: float) -> str:
        """Reason for pairing."""
        base_main = base.get("mainCategory") or ""
        cand_main = candidate.get("mainCategory") or ""
        base_cat = base.get("category") or ""
        cand_cat = candidate.get("category") or ""
        cat_label = cand_cat or categories_by_id.get(candidate.get("category") or "", {}).get("name", "")

        parts = []
        if similarity >= 0.8: parts.append("Similar profile")
        elif similarity <= 0.4 and cand_main and base_main != cand_main: parts.append(f"Contrast with {cand_main}")
        if base_main != cand_main and cand_main: parts.append(f"Balances {base_main or 'dish'} with {cand_main}")
        elif base_cat and cand_cat and base_cat != cand_cat: parts.append(f"Adds variety from {cat_label or 'another category'}")
        if candidate.get("originalPrice") and candidate.get("originalPrice") > candidate.get("price", 0): parts.append("On offer")

        return "; ".join(dict.fromkeys(parts)) if parts else "Pairs well with this dish"

    def _select_diverse_candidates(self, base_dish: Dict[str, Any], candidates: List[Tuple[float, Dict[str, Any], float]], min_recommendations: int, base_embedding: Optional[List[float]], embeddings: Dict[str, List[float]]) -> List[Tuple[float, Dict[str, Any], float]]:
        """Ported diversity selection logic."""
        base_main = (base_dish.get("mainCategory") or "").lower()
        available_counts = defaultdict(int)
        for _, cand, _ in candidates:
            main = (cand.get("mainCategory") or "").lower() or "default"
            available_counts[main] += 1

        total_available = sum(available_counts.values())
        if total_available == 0: return []

        # Sort mains by availability
        sorted_mains = sorted(available_counts.items(), key=lambda x: x[1], reverse=True)
        slots = []
        remaining = min_recommendations
        for main, count in sorted_mains:
            if main == base_main: continue
            if remaining <= 0: break
            target = max(1, min(int((count/total_available) * min_recommendations * 1.2), count, remaining))
            if target > 0:
                slots.append((main, target))
                remaining -= target
        
        if remaining > 0 and base_main in available_counts:
            same_cat_target = min(int(min_recommendations * 0.3), available_counts[base_main], remaining)
            if same_cat_target > 0: slots.append((base_main, same_cat_target))

        # Caps
        caps = {}
        for main, count in available_counts.items():
            base_cap = int(min_recommendations * 0.3) if main == base_main else int(min_recommendations * 0.4)
            caps[main] = min(base_cap, count)
        caps["default"] = min(min_recommendations, total_available)

        counts = defaultdict(int)
        picked_ids = set()
        selected = []
        buckets = defaultdict(list)
        for score, cand, sim in candidates:
            buckets[(cand.get("mainCategory") or "").lower() or "default"].append((score, cand, sim))

        # Fill slots
        for main, need in slots:
            if len(selected) >= min_recommendations: break
            taken = 0
            for score, cand, sim in buckets.get(main, []):
                if cand["id"] in picked_ids: continue
                if counts[main] >= caps.get(main, caps["default"]): continue
                selected.append((score, cand, sim))
                picked_ids.add(cand["id"])
                counts[main] += 1
                taken += 1
                if len(selected) >= min_recommendations or taken >= need: break

        # Backfill
        if len(selected) < min_recommendations:
            for score, cand, sim in candidates:
                if len(selected) >= min_recommendations: break
                if cand["id"] in picked_ids: continue
                main = (cand.get("mainCategory") or "").lower() or "default"
                if counts[main] >= caps.get(main, caps["default"]): continue
                selected.append((score, cand, sim))
                picked_ids.add(cand["id"])
                counts[main] += 1

        return selected[:min_recommendations]

@frappe.whitelist()
def get_recommendations(dishes, categories=None, min_recommendations=9):
    """API endpoint for recommendation generation."""
    try:
        engine = RecommendationEngine()
        results, insufficient = engine.generate_recommendations(dishes, categories, min_recommendations)
        return {
            "success": True,
            "data": {
                "recommendations": results
            },
            "insufficient": insufficient
        }
    except Exception as e:
        return handle_ai_error(e)
