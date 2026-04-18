package org.example.backend.controller;

import org.example.backend.model.CookingIngredient;
import org.example.backend.model.Recipe;
import org.example.backend.repository.CookingIngredientRepository;
import org.example.backend.repository.RecipeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chef-quest")
@CrossOrigin(origins = "*") // Adjust for production
public class ChefQuestController {

    @Autowired
    private RecipeRepository recipeRepository;

    @Autowired
    private CookingIngredientRepository ingredientRepository;

    @GetMapping("/recipes")
    public List<Recipe> getAllRecipes() {
        return recipeRepository.findAll();
    }

    @GetMapping("/ingredients")
    public List<CookingIngredient> getAllIngredients() {
        return ingredientRepository.findAll();
    }

    @PostMapping("/admin/recipe")
    public Recipe addRecipe(@RequestBody Recipe recipe) {
        // First save ingredients if they don't have IDs or just link existing ones
        if (recipe.getIngredients() != null) {
            for (CookingIngredient ing : recipe.getIngredients()) {
                if (ing.getId() == null) {
                    ingredientRepository.save(ing);
                }
            }
        }
        return recipeRepository.save(recipe);
    }

    @PostMapping("/admin/ingredient")
    public CookingIngredient addIngredient(@RequestBody CookingIngredient ingredient) {
        return ingredientRepository.save(ingredient);
    }

    @DeleteMapping("/admin/recipe/{id}")
    public void deleteRecipe(@PathVariable Long id) {
        recipeRepository.deleteById(id);
    }

    @DeleteMapping("/admin/ingredient/{id}")
    public void deleteIngredient(@PathVariable Long id) {
        ingredientRepository.deleteById(id);
    }
}
