import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api-url';

export interface CookingIngredient {
  id?: number;
  name: string;
  iconUrl: string;
  x: number;
  y: number;
}

export interface Recipe {
  id?: number;
  title: string;
  description: string;
  rewardPoints: number;
  ingredients: CookingIngredient[];
  bgImageUrl: string;
  finalDishImageUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChefQuestService {
  private apiUrl = `${API_BASE_URL}/api/chef-quest`;

  constructor(private http: HttpClient) { }

  getRecipes(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(`${this.apiUrl}/recipes`);
  }

  getIngredients(): Observable<CookingIngredient[]> {
    return this.http.get<CookingIngredient[]>(`${this.apiUrl}/ingredients`);
  }

  saveRecipe(recipe: Recipe): Observable<Recipe> {
    return this.http.post<Recipe>(`${this.apiUrl}/admin/recipe`, recipe);
  }

  saveIngredient(ingredient: CookingIngredient): Observable<CookingIngredient> {
    return this.http.post<CookingIngredient>(`${this.apiUrl}/admin/ingredient`, ingredient);
  }

  updateRecipe(id: number, recipe: Recipe): Observable<Recipe> {
    return this.http.post<Recipe>(`${this.apiUrl}/admin/recipe`, recipe); // Spring Boot save handles both
  }

  updateIngredient(id: number, ingredient: CookingIngredient): Observable<CookingIngredient> {
    return this.http.post<CookingIngredient>(`${this.apiUrl}/admin/ingredient`, ingredient); // Spring Boot save handles both
  }

  deleteRecipe(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/recipe/${id}`);
  }

  deleteIngredient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/ingredient/${id}`);
  }
}
