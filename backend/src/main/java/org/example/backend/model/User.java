package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
import java.util.Set;
@Data @Entity @Table(name="users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer userId;
    private String username;
    private String firstName;
    private String lastName;
    private String email;
    private String passwordHash;
    private String phone;
    private Integer points;
    
    @ManyToOne @JoinColumn(name="level_id")
    private Level level;
    
    private String status;
    private Date createdAt;
    
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles;
    public void setId(Integer id) { this.userId = id; }
}