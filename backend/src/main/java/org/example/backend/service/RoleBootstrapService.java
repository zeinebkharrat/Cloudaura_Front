package org.example.backend.service;

import org.example.backend.model.Role;
import org.example.backend.repository.RoleRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class RoleBootstrapService {

    private static final List<String> DEFAULT_ROLES = List.of("ROLE_USER", "ROLE_ADMIN", "ROLE_ARTISAN");

    @Bean
    ApplicationRunner roleSeeder(RoleRepository roleRepository) {
        return args -> DEFAULT_ROLES.forEach(roleName -> roleRepository.findByName(roleName)
                .orElseGet(() -> {
                    Role role = new Role();
                    role.setName(roleName);
                    return roleRepository.save(role);
                }));
    }
}
