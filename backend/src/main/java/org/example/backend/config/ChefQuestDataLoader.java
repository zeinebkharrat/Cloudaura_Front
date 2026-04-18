package org.example.backend.config;

import org.example.backend.model.CookingIngredient;
import org.example.backend.model.Recipe;
import org.example.backend.repository.CookingIngredientRepository;
import org.example.backend.repository.RecipeRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;

@Configuration
public class ChefQuestDataLoader {

    @Bean
    CommandLineRunner initChefQuestData(RecipeRepository recipeRepo, CookingIngredientRepository ingRepo) {
        return args -> {
            if (ingRepo.count() == 0) {
                CookingIngredient flour = CookingIngredient.builder().name("Flour").iconUrl("assets/images/flour.png").x(75).y(35).build();
                CookingIngredient sugar = CookingIngredient.builder().name("Sugar").iconUrl("assets/images/sugar.png").x(85).y(35).build();
                CookingIngredient eggs  = CookingIngredient.builder().name("Eggs").iconUrl("assets/images/eggs.png").x(25).y(75).build();
                CookingIngredient milk  = CookingIngredient.builder().name("Milk").iconUrl("assets/images/milk.png").x(35).y(75).build();
                
                ingRepo.saveAll(Arrays.asList(flour, sugar, eggs, milk));

                Recipe cake = Recipe.builder()
                        .title("Cloud Cake")
                        .description("A light and fluffy Tunisian style cake.")
                        .rewardPoints(1000)
                        .ingredients(Arrays.asList(flour, sugar, eggs, milk))
                        .bgImageUrl("assets/images/chef_bg.png")
                        .build();
                
                recipeRepo.save(cake);
                System.out.println("Chef Quest initial data loaded!");
            }
        };
    }
}
