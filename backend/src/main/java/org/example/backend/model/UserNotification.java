package org.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_notifications")
public class UserNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Integer notificationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "type", nullable = false, length = 40)
    private String type;

    @Column(name = "title", nullable = false, length = 180)
    private String title;

    @Column(name = "message", nullable = false, length = 500)
    private String message;

    @Column(name = "route", length = 255)
    private String route;

    @Column(name = "reservation_type", length = 40)
    private String reservationType;

    @Column(name = "reservation_id")
    private Integer reservationId;

    @Column(name = "interaction_count")
    private Integer interactionCount;

    @Column(name = "last_actor_user_id")
    private Integer lastActorUserId;

    @Column(name = "last_actor_name", length = 120)
    private String lastActorName;

    @Column(name = "last_actor_avatar_url", length = 500)
    private String lastActorAvatarUrl;

    @Column(name = "is_read", nullable = false)
    private boolean readFlag;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Integer getNotificationId() {
        return notificationId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getRoute() {
        return route;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public String getReservationType() {
        return reservationType;
    }

    public void setReservationType(String reservationType) {
        this.reservationType = reservationType;
    }

    public Integer getReservationId() {
        return reservationId;
    }

    public void setReservationId(Integer reservationId) {
        this.reservationId = reservationId;
    }

    public Integer getInteractionCount() {
        return interactionCount;
    }

    public void setInteractionCount(Integer interactionCount) {
        this.interactionCount = interactionCount;
    }

    public Integer getLastActorUserId() {
        return lastActorUserId;
    }

    public void setLastActorUserId(Integer lastActorUserId) {
        this.lastActorUserId = lastActorUserId;
    }

    public String getLastActorName() {
        return lastActorName;
    }

    public void setLastActorName(String lastActorName) {
        this.lastActorName = lastActorName;
    }

    public String getLastActorAvatarUrl() {
        return lastActorAvatarUrl;
    }

    public void setLastActorAvatarUrl(String lastActorAvatarUrl) {
        this.lastActorAvatarUrl = lastActorAvatarUrl;
    }

    public boolean isReadFlag() {
        return readFlag;
    }

    public void setReadFlag(boolean readFlag) {
        this.readFlag = readFlag;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
