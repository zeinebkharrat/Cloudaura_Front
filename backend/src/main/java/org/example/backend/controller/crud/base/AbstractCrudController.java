package org.example.backend.controller.crud.base;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Id;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;

public abstract class AbstractCrudController<T> {

    @PersistenceContext
    private EntityManager entityManager;

    private final Class<T> entityClass;
    private final Field idField;

    protected AbstractCrudController(Class<T> entityClass) {
        this.entityClass = entityClass;
        this.idField = resolveIdField(entityClass);
    }

    @GetMapping("/")
    public List<T> findAll() {
        String jpql = "SELECT e FROM " + entityClass.getSimpleName() + " e";
        TypedQuery<T> query = entityManager.createQuery(jpql, entityClass);
        return query.getResultList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<T> findById(@PathVariable String id) {
        Object typedId = parseId(id);
        T entity = entityManager.find(entityClass, typedId);
        if (entity == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(entity);
    }

    @PostMapping("/")
    @Transactional
    public ResponseEntity<T> create(@RequestBody T entity) {
        entityManager.persist(entity);
        return ResponseEntity.status(HttpStatus.CREATED).body(entity);
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<T> update(@PathVariable String id, @RequestBody T entity) {
        Object typedId = parseId(id);
        T existing = entityManager.find(entityClass, typedId);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }

        setId(entity, typedId);
        T updated = entityManager.merge(entity);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable String id) {
        Object typedId = parseId(id);
        T existing = entityManager.find(entityClass, typedId);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }

        entityManager.remove(existing);
        return ResponseEntity.noContent().build();
    }

    private Field resolveIdField(Class<?> type) {
        Class<?> current = type;
        while (current != null && current != Object.class) {
            for (Field field : current.getDeclaredFields()) {
                if (field.isAnnotationPresent(Id.class)) {
                    field.setAccessible(true);
                    return field;
                }
            }
            current = current.getSuperclass();
        }
        throw new IllegalStateException("No @Id field found for " + type.getName());
    }

    private Object parseId(String rawId) {
        Class<?> idType = idField.getType();
        try {
            if (Integer.class.equals(idType) || int.class.equals(idType)) {
                return Integer.valueOf(rawId);
            }
            if (Long.class.equals(idType) || long.class.equals(idType)) {
                return Long.valueOf(rawId);
            }
            if (String.class.equals(idType)) {
                return rawId;
            }
            if (UUID.class.equals(idType)) {
                return UUID.fromString(rawId);
            }
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid id value: " + rawId, ex);
        }
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Unsupported id type for " + entityClass.getSimpleName() + ": " + idType.getName()
        );
    }

    private void setId(T entity, Object idValue) {
        try {
            idField.set(entity, idValue);
        } catch (IllegalAccessException ex) {
            throw new IllegalStateException("Unable to set id on entity " + entityClass.getName(), ex);
        }
    }
}
