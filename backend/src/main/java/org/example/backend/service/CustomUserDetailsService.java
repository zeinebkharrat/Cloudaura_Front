package org.example.backend.service;

import org.example.backend.model.User;
import org.example.backend.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Même logique que {@link AuthService} pour résoudre l’identifiant (email ou pseudo) :
     * une seule requête OR + ordre par id, pour éviter un utilisateur différent de celui de
     * {@code findByIdentifier} (tentatives / verrou) et des échecs de connexion incohérents.
     */
    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        if (identifier == null || identifier.isBlank()) {
            throw new UsernameNotFoundException("User not found");
        }
        String normalized = identifier.trim().toLowerCase(Locale.ROOT);
        User user = userRepository
                .findFirstByUsernameIgnoreCaseOrEmailIgnoreCaseOrderByUserIdAsc(normalized, normalized)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return new CustomUserDetails(user);
    }
    
    /**
     * Custom UserDetails implementation that wraps our User entity
     */
    public static class CustomUserDetails implements UserDetails {
        private final User user;

        public CustomUserDetails(User user) {
            this.user = user;
        }

        public User getUser() {
            return user;
        }

        @Override
        public String getUsername() {
            return user.getUsername();
        }

        @Override
        public String getPassword() {
            return user.getPasswordHash();
        }

        @Override
        public java.util.Collection<org.springframework.security.core.GrantedAuthority> getAuthorities() {
            return user.getRoles().stream()
                    .map(role -> new SimpleGrantedAuthority(role.getName()))
                    .collect(Collectors.toSet());
        }

        @Override
        public boolean isAccountNonExpired() {
            return true;
        }

        @Override
        public boolean isAccountNonLocked() {
            return true;
        }

        @Override
        public boolean isCredentialsNonExpired() {
            return true;
        }

        @Override
        public boolean isEnabled() {
            return "ACTIVE".equals(user.getStatus());
        }
    }
}
